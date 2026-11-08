import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  elementToWarung,
  fetchNearbyEats,
  fetchPlaceById,
  getKnownPlace,
  isNonFoodName,
  loadArea,
  parseNominatim,
  parseOpeningHours,
  parsePhoton,
  saveArea,
  searchPlaces,
} from "./places";
import { hoursLabel, openState, servesKind } from "./warung-data";

const ok = (body: unknown) =>
  Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) } as Response);
const fail = (status = 500) =>
  Promise.resolve({ ok: false, status, json: () => Promise.resolve({}) } as Response);

const KALISARI = { lat: -6.3433, lng: 106.8683 };

const photonKalisari = {
  features: [
    {
      geometry: { coordinates: [KALISARI.lng, KALISARI.lat] },
      properties: {
        osm_type: "R",
        osm_id: 1,
        name: "Kalisari",
        district: "Pasar Rebo",
        city: "Jakarta Timur",
        state: "Jakarta",
        country: "Indonesia",
      },
    },
    // hasil kembar harus dibuang
    {
      geometry: { coordinates: [KALISARI.lng + 0.0001, KALISARI.lat] },
      properties: { osm_type: "N", osm_id: 2, name: "Kalisari", city: "Jakarta Timur" },
    },
  ],
};

const overpassKalisari = {
  elements: [
    {
      type: "node",
      id: 111,
      lat: KALISARI.lat + 0.001,
      lon: KALISARI.lng,
      tags: {
        name: "Warung Nasi Kalisari",
        amenity: "restaurant",
        cuisine: "indonesian",
        opening_hours: "Mo-Su 07:00-21:00",
        phone: "0812",
      },
    },
    {
      type: "way",
      id: 222,
      center: { lat: KALISARI.lat, lon: KALISARI.lng + 0.001 },
      tags: { name: "Kopi Pojok", amenity: "cafe" },
    },
    {
      type: "node",
      id: 333,
      lat: KALISARI.lat,
      lon: KALISARI.lng,
      tags: { amenity: "restaurant" },
    }, // tanpa nama: dilewati
  ],
};

beforeEach(() => {
  sessionStorage.clear();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("searchPlaces", () => {
  it("menemukan tempat di mana pun lewat Photon (mis. Kalisari, jauh dari lokasi default)", async () => {
    const f = vi.fn().mockImplementation(() => ok(photonKalisari));
    vi.stubGlobal("fetch", f);
    const res = await searchPlaces("kalisari", { near: { lat: -6.2088, lng: 106.8456 } });
    expect(res).toHaveLength(1); // kembar dibuang
    expect(res[0]).toMatchObject({ name: "Kalisari", lat: KALISARI.lat, lng: KALISARI.lng });
    expect(res[0]!.detail).toContain("Jakarta Timur");
    expect(String(f.mock.calls[0]![0])).toContain("q=kalisari");
  });

  it("pindah ke Nominatim kalau Photon error", async () => {
    const f = vi
      .fn()
      .mockImplementationOnce(() => fail(503))
      .mockImplementationOnce(() =>
        ok([
          {
            place_id: 9,
            lat: "-6.3433",
            lon: "106.8683",
            name: "Kalisari",
            display_name: "Kalisari, Pasar Rebo, Jakarta Timur, Indonesia",
          },
        ]),
      );
    vi.stubGlobal("fetch", f);
    const res = await searchPlaces("kalisari");
    expect(f).toHaveBeenCalledTimes(2);
    expect(String(f.mock.calls[1]![0])).toContain("nominatim");
    expect(res[0]).toMatchObject({ name: "Kalisari", lat: -6.3433, lng: 106.8683 });
    expect(res[0]!.detail).toBe("Pasar Rebo, Jakarta Timur, Indonesia");
  });

  it("pindah ke Nominatim kalau Photon tidak menemukan apa-apa", async () => {
    const f = vi
      .fn()
      .mockImplementationOnce(() => ok({ features: [] }))
      .mockImplementationOnce(() => ok([{ lat: "1", lon: "2", display_name: "Tempat X, Kota Y" }]));
    vi.stubGlobal("fetch", f);
    expect((await searchPlaces("tempat x"))[0]?.name).toBe("Tempat X");
  });

  it("tidak memanggil API untuk teks kosong", async () => {
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    expect(await searchPlaces("   ")).toEqual([]);
    expect(f).not.toHaveBeenCalled();
  });

  it("parser mengabaikan data rusak", () => {
    expect(
      parsePhoton({
        features: [
          { properties: { name: "x" } },
          { geometry: { coordinates: [1, 2] }, properties: {} },
        ],
      }),
    ).toEqual([]);
    expect(parseNominatim([{ lat: "abc", lon: "1", display_name: "A" }])).toEqual([]);
  });
});

describe("fetchNearbyEats", () => {
  it("mendeteksi warung di sekitar titik pencarian dan mengabaikan yang tanpa nama", async () => {
    const f = vi.fn().mockImplementation(() => ok(overpassKalisari));
    vi.stubGlobal("fetch", f);
    const ws = await fetchNearbyEats({ lat: KALISARI.lat + 0.01, lng: KALISARI.lng + 0.01 });
    expect(ws.map((w) => w.name)).toEqual(["Warung Nasi Kalisari", "Kopi Pojok"]);
    const body = decodeURIComponent(String((f.mock.calls[0]![1] as RequestInit).body));
    expect(body).toContain("around:1200");
    expect(body).toContain(String(KALISARI.lat + 0.01));
  });

  it("mencoba server Overpass cadangan kalau yang pertama gagal", async () => {
    const f = vi
      .fn()
      .mockImplementationOnce(() => fail(504))
      .mockImplementationOnce(() => ok(overpassKalisari));
    vi.stubGlobal("fetch", f);
    const ws = await fetchNearbyEats({ lat: 10.001, lng: 20.001 });
    expect(f).toHaveBeenCalledTimes(2);
    expect(ws).toHaveLength(2);
  });

  it("melempar error kalau semua server gagal", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => fail(500)),
    );
    await expect(fetchNearbyEats({ lat: 11.001, lng: 21.001 })).rejects.toThrow();
  });

  it("memakai cache untuk titik yang sama", async () => {
    const f = vi.fn().mockImplementation(() => ok(overpassKalisari));
    vi.stubGlobal("fetch", f);
    await fetchNearbyEats({ lat: 12.0001, lng: 22.0001 });
    await fetchNearbyEats({ lat: 12.0002, lng: 22.0002 });
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("tempat yang terdeteksi bisa dibuka lagi lewat id (untuk halaman profil)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => ok(overpassKalisari)),
    );
    await fetchNearbyEats({ lat: 13.001, lng: 23.001 });
    expect(getKnownPlace("osm-node-111")?.name).toBe("Warung Nasi Kalisari");
    expect(getKnownPlace("osm-way-222")?.name).toBe("Kopi Pojok");
  });
});

describe("fetchPlaceById", () => {
  it("mengambil satu tempat dari id osm-…", async () => {
    const f = vi.fn().mockImplementation(() => ok({ elements: [overpassKalisari.elements[0]] }));
    vi.stubGlobal("fetch", f);
    const w = await fetchPlaceById("osm-node-111");
    expect(w?.id).toBe("osm-node-111");
    expect(decodeURIComponent(String((f.mock.calls[0]![1] as RequestInit).body))).toContain(
      "node(111)",
    );
  });

  it("menolak id yang bukan dari peta tanpa memanggil jaringan", async () => {
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    expect(await fetchPlaceById("bu-sri")).toBeNull();
    expect(f).not.toHaveBeenCalled();
  });
});

describe("elementToWarung", () => {
  it("memetakan tag OpenStreetMap ke data warung", () => {
    const w = elementToWarung(overpassKalisari.elements[0] as never)!;
    expect(w).toMatchObject({
      id: "osm-node-111",
      name: "Warung Nasi Kalisari",
      category: "Restoran · Indonesia",
      phone: "0812",
      open: "07:00",
      close: "21:00",
      source: "osm",
      registered: false,
      menu: [],
    });
    expect(servesKind(w, "makanan")).toBe(true);
    expect(servesKind(w, "minuman")).toBe(false);
  });

  it("kafe dihitung sebagai minuman, jam buka kosong = belum diketahui", () => {
    const w = elementToWarung(overpassKalisari.elements[1] as never)!;
    expect(w.id).toBe("osm-way-222");
    expect(servesKind(w, "minuman")).toBe(true);
    expect(openState(w, new Date())).toBe("unknown");
    expect(hoursLabel(w)).toBe("Jam buka belum diketahui");
    expect(w.address).toBe("Alamat belum tersedia");
  });

  it("melewati elemen tanpa nama atau tanpa koordinat", () => {
    expect(elementToWarung({ type: "node", id: 1, lat: 1, lon: 1, tags: {} })).toBeNull();
    expect(elementToWarung({ type: "node", id: 1, tags: { name: "x" } })).toBeNull();
  });
});

describe("parseOpeningHours", () => {
  it("menerima pola yang jelas", () => {
    expect(parseOpeningHours("24/7")).toEqual({ open: "00:00", close: "24:00" });
    expect(parseOpeningHours("Mo-Su 08:00-21:00")).toEqual({ open: "08:00", close: "21:00" });
    expect(parseOpeningHours("7:30-17:00")).toEqual({ open: "07:30", close: "17:00" });
  });
  it("menolak pola yang beda tiap hari supaya tidak menampilkan jam yang salah", () => {
    expect(parseOpeningHours("Mo-Fr 08:00-17:00; Sa off")).toBeNull();
    expect(parseOpeningHours("Mo-Fr 08:00-17:00; Sa,Su 09:00-12:00")).toBeNull();
    expect(parseOpeningHours("")).toBeNull();
    expect(parseOpeningHours(undefined)).toBeNull();
  });
});

describe("openState", () => {
  const at = (h: number, m = 0) => new Date(2026, 10, 6, h, m);
  it("buka / tutup / lewat tengah malam / 24 jam", () => {
    expect(openState({ open: "08:00", close: "21:00" }, at(12))).toBe("open");
    expect(openState({ open: "08:00", close: "21:00" }, at(22))).toBe("closed");
    expect(openState({ open: "17:00", close: "02:00" }, at(1))).toBe("open");
    expect(openState({ open: "00:00", close: "24:00" }, at(23, 59))).toBe("open");
  });
});

describe("isNonFoodName (Filter Penolak Nama Jalan & Fasilitas Non-Kuliner)", () => {
  it("menolak nama jalan dan gang murni", () => {
    expect(isNonFoodName("Jalan Kelapa Dua Raya")).toBe(true);
    expect(isNonFoodName("Jl. Margonda Raya")).toBe(true);
    expect(isNonFoodName("Gang Haji Salmi")).toBe(true);
    expect(isNonFoodName("Gg. Kancil")).toBe(true);
    expect(isNonFoodName("Jalan Tol Jagorawi")).toBe(true);
  });

  it("menolak fasilitas umum, instansi, kampus, dan tempat ibadah", () => {
    expect(isNonFoodName("Kampus G Universitas Gunadarma")).toBe(true);
    expect(isNonFoodName("Universitas Indonesia")).toBe(true);
    expect(isNonFoodName("Stasiun Pondok Cina")).toBe(true);
    expect(isNonFoodName("Masjid Al-Barkah")).toBe(true);
    expect(isNonFoodName("SPBU Pertamina")).toBe(true);
    expect(isNonFoodName("ATM BCA")).toBe(true);
    expect(isNonFoodName("Klinik Pratama")).toBe(true);
    expect(isNonFoodName("Kost Putra Barokah")).toBe(true);
  });

  it("menerima nama warung, kedai, kafe, dan restoran riil", () => {
    expect(isNonFoodName("Warteg Ibu Lina")).toBe(false);
    expect(isNonFoodName("Sadel Street Coffee")).toBe(false);
    expect(isNonFoodName("McDonald's")).toBe(false);
    expect(isNonFoodName("Richeese Factory")).toBe(false);
    expect(isNonFoodName("Mie Ayam & Bakso Wonogiri")).toBe(false);
    expect(isNonFoodName("Warkop Nusantara")).toBe(false);
    expect(isNonFoodName("Kopi Kenangan")).toBe(false);
    expect(isNonFoodName("Ayam Geprek Sambal Korek")).toBe(false);
  });
});

describe("elementToWarung penolakan non-kuliner", () => {
  it("menolak jika entitas adalah jalan (highway)", () => {
    expect(
      elementToWarung({
        type: "way",
        id: 999,
        lat: -6.35,
        lon: 106.84,
        tags: { name: "Jalan Kelapa Dua Raya", highway: "secondary" },
      }),
    ).toBeNull();
  });

  it("menolak jika nama adalah nama jalan meskipun ada tag amenity tidak sengaja", () => {
    expect(
      elementToWarung({
        type: "way",
        id: 998,
        lat: -6.35,
        lon: 106.84,
        tags: { name: "Jalan Kelapa Dua Raya", amenity: "restaurant" },
      }),
    ).toBeNull();
  });
});

describe("lokasi pencarian terakhir", () => {
  it("disimpan dan dibaca kembali, dan bisa dihapus", () => {
    expect(loadArea()).toBeNull();
    saveArea({ name: "Kalisari", ...KALISARI });
    expect(loadArea()).toEqual({ name: "Kalisari", ...KALISARI });
    saveArea(null);
    expect(loadArea()).toBeNull();
  });
  it("mengabaikan data rusak", () => {
    sessionStorage.setItem("lokaloka-area-v1", "{bukan json");
    expect(loadArea()).toBeNull();
  });
});
