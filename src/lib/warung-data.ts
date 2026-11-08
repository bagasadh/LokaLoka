export type PriceSource = "owner" | "google_places" | "other" | "community";

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  photo: string;
  category: "makanan" | "minuman";
  source: PriceSource;
  /** minutes ago the price was last updated (dummy) */
  updatedMinAgo: number;
}

export interface Review {
  id: string;
  warungId: string;
  author: string;
  rating: number;
  text: string;
  photos: string[];
  receipt: string;
  createdAt: number;
}

export interface Warung {
  id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  address: string;
  phone: string;
  open: string;
  close: string;
  cover: string;
  registered: boolean; // pemilik sudah daftar di Lokaloka
  menu: MenuItem[];
  /** Menerima pembayaran non-tunai QRIS */
  hasQris?: boolean;
  /** "osm" = terdeteksi dari peta (OpenStreetMap); kosong = data contoh bawaan */
  source?: "osm";
  /** jenis jualan, dipakai filter Makanan/Minuman kalau menu belum ada */
  kinds?: MenuItem["category"][];
}

export const USER_LOCATION = { lat: -6.2088, lng: 106.8456 };

/** Cover netral untuk tempat hasil deteksi peta (belum ada foto). */
export const PLACEHOLDER_COVER =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 100"><rect width="160" height="100" fill="#2b2b2b"/><g fill="none" stroke="#8a8a8a" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"><path d="M54 44h52v28H54z"/><path d="M50 44l6-14h48l6 14"/><path d="M72 72V56h16v16"/></g></svg>',
  );

export interface CommentReply {
  id: string;
  author: string;
  isOwner?: boolean;
  createdAt: number;
  text: string;
}

export interface WarungComment {
  id: string;
  warungId: string;
  author: string;
  isOwner?: boolean;
  createdAt: number;
  text: string;
  replies: CommentReply[];
}

export { WARUNGS, SEED_REVIEWS, SEED_COMMENTS } from "./sample-warungs";

export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function formatDistance(km: number) {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

export function formatRupiah(n: number) {
  return "Rp" + n.toLocaleString("id-ID");
}

export function formatAgo(min: number) {
  if (min < 60) return `${min} menit lalu`;
  if (min < 60 * 24) return `${Math.round(min / 60)} jam lalu`;
  return `${Math.round(min / (60 * 24))} hari lalu`;
}

export function isOpenAt(w: Pick<Warung, "open" | "close">, d: Date) {
  const mins = d.getHours() * 60 + d.getMinutes();
  const [oh = 0, om = 0] = w.open.split(":").map(Number);
  const [ch = 0, cm = 0] = w.close.split(":").map(Number);
  const o = oh * 60 + om;
  const c = ch * 60 + cm;
  return c > o ? mins >= o && mins < c : mins >= o || mins < c;
}

export type OpenState = "open" | "closed" | "unknown";

/** Jam buka kosong (tempat hasil deteksi tanpa data jam) dianggap belum diketahui. */
export function openState(w: Pick<Warung, "open" | "close">, d: Date = new Date()): OpenState {
  if (!w.open || !w.close) return "unknown";
  return isOpenAt(w, d) ? "open" : "closed";
}

export function hoursLabel(w: Pick<Warung, "open" | "close">) {
  return w.open && w.close ? `${w.open}–${w.close}` : "Jam buka belum diketahui";
}

export const OPEN_LABEL: Record<OpenState, { text: string; cls: string }> = {
  open: { text: "Buka", cls: "text-success" },
  closed: { text: "Tutup", cls: "text-destructive" },
  unknown: { text: "Jam buka belum diketahui", cls: "text-muted-foreground" },
};

export interface ScheduleInsight {
  isOpen: boolean;
  isClosingSoon: boolean;
  minutesLeft?: number;
  isLateNight: boolean;
}

/**
 * Menganalisis jadwal operasional warung:
 * - isClosingSoon: jika warung sedang buka dan akan tutup dalam <= 45 menit
 * - isLateNight: warung yang buka lewat tengah malam atau bertema kuliner malam
 */
export function getScheduleInsight(
  w: Pick<Warung, "open" | "close" | "name" | "category">,
  d: Date = new Date(),
): ScheduleInsight {
  const open = openState(w, d);
  const isLateNight = isLateNightEatery(w);
  if (open !== "open" || !w.open || !w.close) {
    return { isOpen: false, isClosingSoon: false, isLateNight };
  }

  const mins = d.getHours() * 60 + d.getMinutes();
  const [oh = 0, om = 0] = w.open.split(":").map(Number);
  const [ch = 0, cm = 0] = w.close.split(":").map(Number);
  const o = oh * 60 + om;
  const c = ch * 60 + cm;

  let diff = 0;
  if (c > o) {
    diff = c - mins;
  } else {
    // Jam buka melintasi tengah malam (misal 17:00 - 02:00)
    if (mins >= o) {
      diff = 24 * 60 - mins + c;
    } else {
      diff = c - mins;
    }
  }

  const isClosingSoon = diff > 0 && diff <= 45;

  return {
    isOpen: true,
    isClosingSoon,
    ...(isClosingSoon ? { minutesLeft: Math.max(1, diff) } : {}),
    isLateNight,
  };
}

/**
 * Mendeteksi apakah warung termasuk tempat "Kuliner Malam":
 * - Tutup jam 23:00 ke atas atau jam 00:00–05:00 subuh
 * - Atau namanya/kategorinya mengandung kata kunci malam, angkringan, warkop, taichan, 24 jam
 */
export function isLateNightEatery(
  w: Pick<Warung, "open" | "close" | "name" | "category">,
): boolean {
  const text = `${w.name} ${w.category}`.toLowerCase();
  if (/malam|24 jam|24jam|subuh|taichan|angkringan|warkop|begadang/i.test(text)) {
    return true;
  }
  if (w.close) {
    const [ch = 0] = w.close.split(":").map(Number);
    if (ch >= 23 || ch <= 5) return true;
  }
  return false;
}

/** Jenis jualan: dari menu kalau ada, kalau tidak dari `kinds` hasil deteksi. */
export function servesKind(w: Pick<Warung, "menu" | "kinds">, kind: MenuItem["category"]) {
  return w.menu.some((m) => m.category === kind) || !!w.kinds?.includes(kind);
}

export const SOURCE_LABEL: Record<PriceSource, string> = {
  owner: "Diisi pemilik warung",
  community: "Diperbarui warga/pembeli",
  google_places: "Dari Google Places",
  other: "Dari sumber lain",
};

/** Review can only be submitted with a rating and a receipt photo. */
export function canSubmitReview(input: { rating: number; receipt: string | null }) {
  return input.rating >= 1 && input.rating <= 5 && !!input.receipt;
}

/** Jumlah ulasan warung ini yang menyertakan foto struk/nota pembelian. */
export function receiptCount(reviews: Pick<Review, "warungId" | "receipt">[], warungId: string) {
  return reviews.filter((r) => r.warungId === warungId && !!r.receipt).length;
}

/** Harga termurah di menu (null kalau menu kosong). */
export function minPrice(w: Pick<Warung, "menu">): number | null {
  const prices = w.menu.map((m) => m.price).filter((p) => p > 0);
  return prices.length ? Math.min(...prices) : null;
}

/** Cek apakah warung memiliki menu dengan harga <= maxPrice (atau harga terendah <= maxPrice). */
export function fitsBudget(w: Pick<Warung, "menu">, maxPrice: number): boolean {
  if (maxPrice <= 0) return true;
  const lowest = minPrice(w);
  return lowest !== null ? lowest <= maxPrice : false;
}

/** Menit sejak pemilik terakhir memperbarui harga (null kalau tidak ada harga dari pemilik). */
export function ownerUpdatedMinAgo(w: Pick<Warung, "menu">): number | null {
  const own = w.menu.filter((m) => m.source === "owner").map((m) => m.updatedMinAgo);
  return own.length ? Math.min(...own) : null;
}

export interface QueryMatch {
  /** item menu pertama yang cocok (kalau yang cocok adalah menunya). */
  item: MenuItem | null;
}

/**
 * Cocokkan teks pencarian ke warung: nama, kategori, atau nama menu.
 * Mengembalikan null kalau tidak cocok. Semua kata harus ada (mis. "es teh" cocok dengan "Es Teh Manis").
 */
export function matchWarung(
  w: Pick<Warung, "name" | "category" | "menu">,
  q: string,
): QueryMatch | null {
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return null;
  const has = (text: string) => {
    const t = text.toLowerCase();
    return words.every((wd) => t.includes(wd));
  };
  const item = w.menu.find((m) => has(m.name)) ?? null;
  if (item) return { item };
  if (has(`${w.name} ${w.category}`)) return { item: null };
  return null;
}

/** Emoji representatif untuk kategori makanan/minuman */
export function getFoodEmoji(name: string, category: string): string {
  const text = `${name} ${category}`.toLowerCase();
  if (
    text.includes("kopi") ||
    text.includes("coffee") ||
    text.includes("cafe") ||
    text.includes("kafe")
  ) {
    return "☕";
  }
  if (
    text.includes("teh") ||
    text.includes("tea") ||
    text.includes("jus") ||
    text.includes("juice") ||
    text.includes("boba") ||
    text.includes("es ") ||
    text.includes("drink") ||
    text.includes("minuman") ||
    text.includes("kelapa") ||
    text.includes("cendol") ||
    text.includes("dawet")
  ) {
    return "🥤";
  }
  if (
    text.includes("bakso") ||
    text.includes("mie") ||
    text.includes("mi ") ||
    text.includes("soto") ||
    text.includes("ramen") ||
    text.includes("soup") ||
    text.includes("sup") ||
    text.includes("bihun") ||
    text.includes("kwetiau")
  ) {
    return "🍜";
  }
  if (
    text.includes("sate") ||
    text.includes("satay") ||
    text.includes("grill") ||
    text.includes("bbq") ||
    text.includes("steak")
  ) {
    return "🍢";
  }
  if (
    text.includes("martabak") ||
    text.includes("roti") ||
    text.includes("kue") ||
    text.includes("bakery") ||
    text.includes("pisang") ||
    text.includes("snack") ||
    text.includes("gorengan") ||
    text.includes("donat")
  ) {
    return "🥞";
  }
  if (
    text.includes("burger") ||
    text.includes("pizza") ||
    text.includes("fast food") ||
    text.includes("hotdog")
  ) {
    return "🍔";
  }
  if (
    text.includes("nasi") ||
    text.includes("padang") ||
    text.includes("ayam") ||
    text.includes("bebek") ||
    text.includes("warteg") ||
    text.includes("rice") ||
    text.includes("pecel") ||
    text.includes("lele") ||
    text.includes("geprek") ||
    text.includes("rames")
  ) {
    return "🍛";
  }
  return "🍽️";
}

export interface RepresentativeItem {
  emoji: string;
  price: number | null;
  label: string;
  item: MenuItem | null;
}

/**
 * Mengambil menu representatif untuk penanda peta dan ringkasan kartu.
 * Mencegah ketidaksesuaian ikon makanan dengan harga minuman (mis. ikon mie ayam tapi harga es teh 2rb).
 */
export function getRepresentativeItem(
  w?: (Pick<Warung, "name" | "category" | "menu"> & { kinds?: ("makanan" | "minuman")[] }) | null,
  preferredCategory?: "makanan" | "minuman",
): RepresentativeItem {
  if (!w) {
    return {
      emoji: "🍽️",
      price: null,
      label: "",
      item: null,
    };
  }
  const name = w.name || "";
  const category = w.category || "";
  const text = `${name} ${category}`.toLowerCase();
  const isDrinkPlace =
    (w.kinds?.length === 1 && w.kinds[0] === "minuman") ||
    /kopi|cafe|kafe|boba|jus|juice|tea|teh|kedai kopi|coffee/i.test(text);

  const primaryCategory = preferredCategory ?? (isDrinkPlace ? "minuman" : "makanan");

  // Cari item pada kategori utama yang harganya valid (> 0)
  const primaryItems = (w.menu || []).filter(
    (m) => m && m.category === primaryCategory && typeof m.price === "number" && m.price > 0,
  );

  // Jika tidak ada item di kategori utama, gunakan semua menu yang memiliki harga > 0
  const candidateItems =
    primaryItems.length > 0
      ? primaryItems
      : (w.menu || []).filter((m) => m && typeof m.price === "number" && m.price > 0);

  const cheapest =
    candidateItems.length > 0 ? [...candidateItems].sort((a, b) => a.price - b.price)[0] : null;

  // Tentukan emoji berdasarkan item termurah atau nama/kategori warung
  const emoji = cheapest
    ? getFoodEmoji(cheapest.name || "", cheapest.category || "")
    : getFoodEmoji(name, category);

  if (cheapest) {
    const k = Math.round(cheapest.price / 1000);
    return {
      emoji,
      price: cheapest.price,
      label: `Rp ${k}k`,
      item: cheapest,
    };
  }

  // Jika tidak ada menu / harga sama sekali, pakai nama pendek warung
  const shortName = name.replace(/^(warung|kedai|rm|depot)\s+/i, "").trim();
  const label = shortName.length > 10 ? shortName.slice(0, 9) + "…" : shortName;

  return {
    emoji,
    price: null,
    label,
    item: null,
  };
}
