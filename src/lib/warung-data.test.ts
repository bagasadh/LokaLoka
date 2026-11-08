import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, actions, getWarung, isBookmarked } from "./store";
import {
  WARUNGS,
  canSubmitReview,
  fitsBudget,
  getRepresentativeItem,
  getScheduleInsight,
  isLateNightEatery,
  minPrice,
  openState,
} from "./warung-data";

describe("review requires receipt", () => {
  it("rejects a review without a receipt photo", () => {
    expect(canSubmitReview({ rating: 5, receipt: null })).toBe(false);
  });
  it("rejects a review without stars", () => {
    expect(canSubmitReview({ rating: 0, receipt: "data:image/png;base64,x" })).toBe(false);
  });
  it("accepts a review with stars and receipt", () => {
    expect(canSubmitReview({ rating: 4, receipt: "data:image/png;base64,x" })).toBe(true);
  });
});

describe("budget filter & minPrice", () => {
  const warungSample = {
    menu: [
      {
        id: "1",
        name: "Es Teh",
        price: 4000,
        category: "minuman" as const,
        photo: "",
        source: "owner" as const,
        updatedMinAgo: 0,
      },
      {
        id: "2",
        name: "Nasi Rames",
        price: 15000,
        category: "makanan" as const,
        photo: "",
        source: "owner" as const,
        updatedMinAgo: 0,
      },
      {
        id: "3",
        name: "Ayam Bakar",
        price: 25000,
        category: "makanan" as const,
        photo: "",
        source: "owner" as const,
        updatedMinAgo: 0,
      },
    ],
  };

  it("calculates minPrice accurately", () => {
    expect(minPrice(warungSample)).toBe(4000);
    expect(minPrice({ menu: [] })).toBeNull();
  });

  it("fitsBudget filters correctly according to lowest price in warung", () => {
    expect(fitsBudget(warungSample, 0)).toBe(true); // 0 = no budget limit
    expect(fitsBudget(warungSample, 3000)).toBe(false);
    expect(fitsBudget(warungSample, 4000)).toBe(true);
    expect(fitsBudget(warungSample, 15000)).toBe(true);
    expect(fitsBudget({ menu: [] }, 15000)).toBe(false);
  });

  it("openState works with default date parameter", () => {
    const warungOpen = { open: "08:00", close: "22:00" };
    expect(["open", "closed"]).toContain(openState(warungOpen));
    expect(openState({ open: "", close: "" })).toBe("unknown");
  });
});

describe("bookmark store actions", () => {
  it("toggles bookmark on and off", () => {
    const fakeId = "warung-test-bookmark";
    const fakeState = {
      user: null,
      reviews: [],
      comments: [],
      menuOverrides: {},
      bookmarks: [],
      settings: DEFAULT_SETTINGS,
      priceReports: [],
      qrisOverrides: {},
    };
    const initialBookmark = isBookmarked(fakeState, fakeId);
    expect(initialBookmark).toBe(false);

    const added = actions.toggleBookmark(fakeId);
    expect(added).toBe(true);

    const removed = actions.toggleBookmark(fakeId);
    expect(removed).toBe(false);
  });
});

describe("crowdsourced price reporting actions", () => {
  it("updates existing menu item price with community tag", () => {
    const sample = WARUNGS[0]!;
    const item = sample.menu[0]!;
    const newPrice = item.price + 2000;

    const ok = actions.updateMenuItemPrice(
      sample.id,
      item.id,
      newPrice,
      "Budi Pembeli",
      "Harga naik per bulan ini",
    );
    expect(ok).toBe(true);

    const updated = getWarung(
      {
        user: null,
        reviews: [],
        comments: [],
        menuOverrides: {
          [sample.id]: sample.menu.map((m) =>
            m.id === item.id ? { ...m, price: newPrice, source: "community" as const } : m,
          ),
        },
        bookmarks: [],
        settings: DEFAULT_SETTINGS,
        priceReports: [],
        qrisOverrides: {},
      },
      sample.id,
    );
    expect(updated?.menu[0]?.price).toBe(newPrice);
  });

  it("adds new menu item with community tag", () => {
    const sample = WARUNGS[0]!;
    const newItem = actions.addMenuItem(
      sample.id,
      {
        name: "Es Jeruk Peras Jumbo",
        price: 7000,
        category: "minuman",
      },
      "Siti",
      "Menu baru",
    );
    expect(newItem).not.toBeNull();
    expect(newItem?.name).toBe("Es Jeruk Peras Jumbo");
    expect(newItem?.source).toBe("community");
  });

  it("records getok harga alert", () => {
    const sample = WARUNGS[0]!;
    const report = actions.reportGetokAlert(sample.id, {
      itemName: "Ayam Bakar",
      pricePaid: 50000,
      note: "Harga pas bayar beda jauh dari daftar menu",
      reporter: "Andi",
    });
    expect(report.type).toBe("getok_alert");
    expect(report.newPrice).toBe(50000);
    expect(report.warungId).toBe(sample.id);
  });
});

describe("getRepresentativeItem", () => {
  it("prevents showing beverage price with food icon for food stalls", () => {
    const mieBaksoWarung = {
      name: "Mie Ayam & Bakso Wonogiri",
      category: "Mie · Bakso",
      kinds: ["makanan" as const],
      menu: [
        {
          id: "m1",
          name: "Mie Ayam Pangsit",
          price: 14000,
          category: "makanan" as const,
          photo: "",
          source: "owner" as const,
          updatedMinAgo: 0,
        },
        {
          id: "m2",
          name: "Bakso Urat",
          price: 17000,
          category: "makanan" as const,
          photo: "",
          source: "owner" as const,
          updatedMinAgo: 0,
        },
        {
          id: "m3",
          name: "Es Teh Tawar",
          price: 2000,
          category: "minuman" as const,
          photo: "",
          source: "owner" as const,
          updatedMinAgo: 0,
        },
      ],
    };

    const rep = getRepresentativeItem(mieBaksoWarung);
    // Harusnya menampilkan harga makanan terendah (14k) dengan emoji mie 🍜, bukan harga es teh 2k
    expect(rep.price).toBe(14000);
    expect(rep.label).toBe("Rp 14k");
    expect(rep.emoji).toBe("🍜");
    expect(rep.item?.name).toBe("Mie Ayam Pangsit");
  });

  it("shows beverage price for beverage stalls", () => {
    const kedaiKopi = {
      name: "Kedai Kopi Santai",
      category: "Kopi & Minuman",
      kinds: ["minuman" as const],
      menu: [
        {
          id: "d1",
          name: "Es Kopi Susu",
          price: 12000,
          category: "minuman" as const,
          photo: "",
          source: "owner" as const,
          updatedMinAgo: 0,
        },
      ],
    };

    const rep = getRepresentativeItem(kedaiKopi);
    expect(rep.price).toBe(12000);
    expect(rep.label).toBe("Rp 12k");
    expect(rep.emoji).toBe("☕");
  });
});

describe("komentar & tanya jawab warung (Q&A)", () => {
  it("menambahkan komentar pertanyaan baru ke warung tanpa syarat struk", () => {
    const comment = actions.addComment(
      "bu-sri",
      "Parkir mobil muat berapa ya kak?",
      "Rian Mahasiswa",
    );
    expect(comment.id).toBeDefined();
    expect(comment.warungId).toBe("bu-sri");
    expect(comment.author).toBe("Rian Mahasiswa");
    expect(comment.text).toBe("Parkir mobil muat berapa ya kak?");
    expect(comment.replies).toEqual([]);
    expect(comment.isOwner).toBe(false);
  });

  it("menambahkan balasan ke komentar yang sudah ada", () => {
    const comment = actions.addComment("bu-sri", "Bisa bayar QRIS ga?", "Dinda");
    const reply = actions.addCommentReply(
      comment.id,
      "Bisa kak, semua e-wallet bisa",
      "Warga Sekitar",
    );
    expect(reply).not.toBeNull();
    expect(reply?.text).toBe("Bisa kak, semua e-wallet bisa");
    expect(reply?.author).toBe("Warga Sekitar");
  });

  it("menandai balasan pemilik warung dengan status isOwner true jika login sebagai pemilik", () => {
    actions.login("Bu Sri", "busri@example.com");
    actions.claimWarung("bu-sri");

    const comment = actions.addComment(
      "bu-sri",
      "Menu ayam bakar ready jam berapa ya?",
      "Pengunjung",
    );
    const reply = actions.addCommentReply(comment.id, "Ready mulai jam 11 siang kak!", "Bu Sri");
    expect(reply?.isOwner).toBe(true);

    actions.logout();
  });
});

describe("pengaturan & preferensi aplikasi (settings)", () => {
  it("mengatur izin lokasi (toggle location enabled)", () => {
    actions.setSettings({ locationEnabled: true });
    const toggledOff = actions.toggleLocationEnabled();
    expect(toggledOff).toBe(false);

    const toggledOn = actions.toggleLocationEnabled();
    expect(toggledOn).toBe(true);
  });

  it("mengatur tema warna peta (dark dan light)", () => {
    actions.setMapTheme("light");
    actions.setMapTheme("dark");
  });
});

describe("schedule insight & kuliner malam", () => {
  it("mendeteksi status segera tutup jika sisa waktu <= 45 menit", () => {
    const warung = {
      name: "Warung Tes Buka",
      category: "Nasi",
      open: "10:00",
      close: "22:00",
    };
    // Jam 21:30 (30 menit sebelum tutup jam 22:00)
    const testTime = new Date("2026-11-08T21:30:00");
    const insight = getScheduleInsight(warung, testTime);
    expect(insight.isOpen).toBe(true);
    expect(insight.isClosingSoon).toBe(true);
    expect(insight.minutesLeft).toBe(30);
  });

  it("mendeteksi warung masih buka normal jika sisa waktu > 45 menit", () => {
    const warung = {
      name: "Warung Tes Buka",
      category: "Nasi",
      open: "10:00",
      close: "22:00",
    };
    // Jam 14:00 (8 jam sebelum tutup)
    const testTime = new Date("2026-11-08T14:00:00");
    const insight = getScheduleInsight(warung, testTime);
    expect(insight.isOpen).toBe(true);
    expect(insight.isClosingSoon).toBe(false);
  });

  it("mendeteksi kuliner malam berdasarkan jam tutup larut atau kata kunci", () => {
    const warungMalam = {
      name: "Nasi Uduk Malam Mas Dimas",
      category: "Nasi uduk",
      open: "18:00",
      close: "03:00",
    };
    expect(isLateNightEatery(warungMalam)).toBe(true);

    const warkop = {
      name: "Warkop 24 Jam Sabang",
      category: "Kopi",
      open: "00:00",
      close: "23:59",
    };
    expect(isLateNightEatery(warkop)).toBe(true);

    const warungSiang = {
      name: "Soto Ayam Pak Joko",
      category: "Soto",
      open: "08:00",
      close: "17:00",
    };
    expect(isLateNightEatery(warungSiang)).toBe(false);
  });
});

describe("QRIS payment support", () => {
  it("mengatur dan memperbarui status QRIS warung", () => {
    const id = "bu-sri";
    actions.setWarungQris(id, true);
    const w = getWarung(
      {
        user: null,
        reviews: [],
        comments: [],
        menuOverrides: {},
        bookmarks: [],
        settings: DEFAULT_SETTINGS,
        priceReports: [],
        qrisOverrides: { [id]: true },
      },
      id,
    );
    expect(w?.hasQris).toBe(true);
  });
});
