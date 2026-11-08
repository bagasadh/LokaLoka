import { describe, expect, it } from "vitest";
import { analyzeMenuItemPrice, calculateWarungPriceRadar, findPriceBenchmark } from "./price-radar";
import type { MenuItem, Warung } from "./warung-data";

describe("Price Radar & Anti-Getok Logic", () => {
  it("menemukan benchmark kuliner yang sesuai berdasarkan nama", () => {
    const esTeh = findPriceBenchmark("Es Teh Manis Segar", "minuman");
    expect(esTeh).not.toBeNull();
    expect(esTeh?.id).toBe("es-teh-manis");
    expect(esTeh?.avgPrice).toBe(4000);

    const nasgor = findPriceBenchmark("Nasi Goreng Telur Dadar", "makanan");
    expect(nasgor).not.toBeNull();
    expect(nasgor?.id).toBe("nasi-goreng-biasa");

    const mieAyam = findPriceBenchmark("Mie Ayam Pangsit Komplit", "makanan");
    expect(mieAyam).not.toBeNull();
    expect(mieAyam?.id).toBe("mie-ayam-biasa");
  });

  it("mengidentifikasi menu murah / hemat di bawah rata-rata pasar", () => {
    const cheapTeh: MenuItem = {
      id: "m1",
      name: "Es Teh Manis",
      price: 2500, // benchmark avg is 4000 -> -38%
      photo: "",
      category: "minuman",
      source: "owner",
      updatedMinAgo: 5,
    };

    const res = analyzeMenuItemPrice(cheapTeh);
    expect(res.tier).toBe("cheap");
    expect(res.percentDiff).toBeLessThan(-15);
    expect(res.label).toContain("Hemat");
  });

  it("mengidentifikasi menu wajar standar pasaran", () => {
    const fairNasgor: MenuItem = {
      id: "m2",
      name: "Nasi Goreng Telur",
      price: 15000, // benchmark avg is 15000 -> 0%
      photo: "",
      category: "makanan",
      source: "owner",
      updatedMinAgo: 10,
    };

    const res = analyzeMenuItemPrice(fairNasgor);
    expect(res.tier).toBe("fair");
    expect(res.percentDiff).toBe(0);
    expect(res.label).toBe("Wajar Pasaran");
  });

  it("mendeteksi indikasi getok harga yang berlebihan", () => {
    const overpricedTeh: MenuItem = {
      id: "m3",
      name: "Es Teh Manis",
      price: 12000, // benchmark avg is 4000 -> +200%
      photo: "",
      category: "minuman",
      source: "owner",
      updatedMinAgo: 2,
    };

    const res = analyzeMenuItemPrice(overpricedTeh);
    expect(res.tier).toBe("overpriced");
    expect(res.percentDiff).toBeGreaterThanOrEqual(40);
    expect(res.label).toContain("Waspada");
  });

  it("menghitung radar kewajaran warung secara menyeluruh", () => {
    const sampleWarung: Warung = {
      id: "w-normal",
      name: "Warung Berkah",
      category: "Nasi & lauk",
      lat: -6.2,
      lng: 106.8,
      address: "Jl. Mawar No. 1",
      phone: "0812345678",
      open: "08:00",
      close: "21:00",
      cover: "",
      registered: true,
      menu: [
        {
          id: "1",
          name: "Nasi Goreng Telur",
          price: 15000,
          category: "makanan",
          source: "owner",
          updatedMinAgo: 5,
          photo: "",
        },
        {
          id: "2",
          name: "Es Teh Manis",
          price: 4000,
          category: "minuman",
          source: "owner",
          updatedMinAgo: 5,
          photo: "",
        },
      ],
    };

    const radar = calculateWarungPriceRadar(sampleWarung, { receiptCount: 3 });
    expect(radar.tier).toBe("fair");
    expect(radar.score).toBeGreaterThanOrEqual(75);
    expect(radar.hasVerifiedReceipts).toBe(true);
    expect(radar.receiptCount).toBe(3);
    expect(radar.analyzedCount).toBe(2);
  });

  it("menyalakan alarm getok harga jika ada item primer dengan markup ekstrem", () => {
    const touristTrapWarung: Warung = {
      id: "w-trap",
      name: "Warung Tepi Wisata",
      category: "Khas daerah",
      lat: -6.2,
      lng: 106.8,
      address: "Kawasan Wisata",
      phone: "",
      open: "09:00",
      close: "22:00",
      cover: "",
      registered: false,
      menu: [
        {
          id: "1",
          name: "Es Teh Manis",
          price: 15000, // avg 4000 -> +275%
          category: "minuman",
          source: "owner",
          updatedMinAgo: 5,
          photo: "",
        },
        {
          id: "2",
          name: "Mie Ayam Pangsit",
          price: 16000, // avg 14000 -> wajar
          category: "makanan",
          source: "owner",
          updatedMinAgo: 5,
          photo: "",
        },
      ],
    };

    const radar = calculateWarungPriceRadar(touristTrapWarung);
    expect(radar.tier).toBe("overpriced");
    expect(radar.title).toBe("Waspada Potensi Getok Harga");
    expect(radar.highestMarkupItem?.item.name).toBe("Es Teh Manis");
  });

  it("menangani warung tanpa menu dengan graceful fallback", () => {
    const emptyWarung: Warung = {
      id: "w-empty",
      name: "Warung Baru",
      category: "Warung",
      lat: -6.2,
      lng: 106.8,
      address: "Jl. Baru",
      phone: "",
      open: "",
      close: "",
      cover: "",
      registered: false,
      menu: [],
    };

    const radar = calculateWarungPriceRadar(emptyWarung);
    expect(radar.analyzedCount).toBe(0);
    expect(radar.title).toBe("Data Harga Belum Tersedia");
  });
});
