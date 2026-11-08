import type { MenuItem, Warung } from "./warung-data";

export type PriceTier = "cheap" | "fair" | "high" | "overpriced";

export interface BenchmarkItem {
  id: string;
  name: string;
  category: "makanan" | "minuman";
  keywords: string[];
  minPrice: number;
  maxPrice: number;
  avgPrice: number;
}

/**
 * Daftar acuan harga standar pasar untuk kuliner populer di Indonesia (khususnya Jabodetabek & kota besar).
 * Nilai ini diperbarui berdasarkan riset lapangan & rata-rata warung makan rakyat.
 */
export const FAIR_PRICE_BENCHMARKS: BenchmarkItem[] = [
  // --- MINUMAN ---
  {
    id: "es-teh-tawar",
    name: "Es Teh Tawar",
    category: "minuman",
    keywords: ["teh tawar", "es tawar", "teh hangat tawar"],
    minPrice: 1500,
    maxPrice: 3500,
    avgPrice: 2500,
  },
  {
    id: "es-teh-manis",
    name: "Es Teh Manis",
    category: "minuman",
    keywords: ["es teh", "teh manis", "es teh manis", "teh botol", "es sweet tea"],
    minPrice: 3000,
    maxPrice: 6000,
    avgPrice: 4000,
  },
  {
    id: "es-jeruk",
    name: "Es Jeruk / Jeruk Panas",
    category: "minuman",
    keywords: ["es jeruk", "jeruk panas", "jeruk hangat", "jeruk peras", "jus jeruk"],
    minPrice: 4000,
    maxPrice: 8000,
    avgPrice: 6000,
  },
  {
    id: "kopi-tubruk",
    name: "Kopi Hitam / Tubruk",
    category: "minuman",
    keywords: ["kopi hitam", "kopi tubruk", "kopi o", "kopi kapal api"],
    minPrice: 3000,
    maxPrice: 6000,
    avgPrice: 4500,
  },
  {
    id: "kopi-susu",
    name: "Es Kopi Susu",
    category: "minuman",
    keywords: ["kopi susu", "es kopi susu", "kopi good day", "kopi luwak"],
    minPrice: 6000,
    maxPrice: 13000,
    avgPrice: 8500,
  },
  {
    id: "jus-buah",
    name: "Aneka Jus Buah",
    category: "minuman",
    keywords: [
      "jus alpukat",
      "jus mangga",
      "jus buah",
      "jus jambu",
      "jus sirsak",
      "jus melon",
      "jus buah",
    ],
    minPrice: 9000,
    maxPrice: 16000,
    avgPrice: 12000,
  },
  {
    id: "air-mineral",
    name: "Air Mineral",
    category: "minuman",
    keywords: ["air mineral", "aqua", "le minerale", "air putih"],
    minPrice: 3000,
    maxPrice: 5000,
    avgPrice: 4000,
  },

  // --- MAKANAN ---
  {
    id: "nasi-goreng-biasa",
    name: "Nasi Goreng Biasa / Telur",
    category: "makanan",
    keywords: [
      "nasi goreng telur",
      "nasgor telur",
      "nasi goreng ayam",
      "nasi goreng biasa",
      "nasgor ayam",
    ],
    minPrice: 12000,
    maxPrice: 18000,
    avgPrice: 15000,
  },
  {
    id: "nasi-goreng-spesial",
    name: "Nasi Goreng Spesial / Seafood",
    category: "makanan",
    keywords: [
      "nasi goreng spesial",
      "nasgor spesial",
      "nasi goreng komplit",
      "nasi goreng seafood",
      "nasi goreng kambing",
    ],
    minPrice: 19000,
    maxPrice: 28000,
    avgPrice: 22000,
  },
  {
    id: "mie-ayam-biasa",
    name: "Mie Ayam Pangsit / Biasa",
    category: "makanan",
    keywords: ["mie ayam", "mie ayam pangsit", "mie yamin", "yamien ayam"],
    minPrice: 11000,
    maxPrice: 17000,
    avgPrice: 14000,
  },
  {
    id: "mie-ayam-bakso",
    name: "Mie Ayam Bakso Komplit",
    category: "makanan",
    keywords: ["mie ayam bakso", "mie ayam ceker", "mie yamin bakso"],
    minPrice: 15000,
    maxPrice: 22000,
    avgPrice: 18000,
  },
  {
    id: "bakso-porsi",
    name: "Bakso Urat / Halus Seporsi",
    category: "makanan",
    keywords: [
      "bakso",
      "bakso urat",
      "bakso halus",
      "bakso urat halus",
      "bakso rudal",
      "bakso malang",
    ],
    minPrice: 14000,
    maxPrice: 22000,
    avgPrice: 17500,
  },
  {
    id: "ayam-geprek",
    name: "Paket Ayam Geprek + Nasi",
    category: "makanan",
    keywords: ["ayam geprek", "paket geprek", "geprek sambal", "geprek mozarella", "geprek keju"],
    minPrice: 13000,
    maxPrice: 21000,
    avgPrice: 16500,
  },
  {
    id: "ayam-goreng-nasi",
    name: "Ayam Goreng / Bakar + Nasi",
    category: "makanan",
    keywords: ["ayam goreng", "ayam bakar", "ayam penyet", "ayam kalasan", "ayam kremes"],
    minPrice: 15000,
    maxPrice: 24000,
    avgPrice: 18500,
  },
  {
    id: "pecel-lele",
    name: "Pecel Lele Sambal",
    category: "makanan",
    keywords: ["pecel lele", "lele goreng", "lele bakar", "lele"],
    minPrice: 12000,
    maxPrice: 19000,
    avgPrice: 15000,
  },
  {
    id: "bebek-goreng",
    name: "Bebek Goreng / Bakar",
    category: "makanan",
    keywords: ["bebek goreng", "bebek bakar", "bebek kremes", "bebek madura"],
    minPrice: 22000,
    maxPrice: 34000,
    avgPrice: 26000,
  },
  {
    id: "soto-ayam",
    name: "Soto Ayam / Soto Daging",
    category: "makanan",
    keywords: ["soto ayam", "soto lamongan", "soto madura", "soto daging", "soto betawi"],
    minPrice: 13000,
    maxPrice: 22000,
    avgPrice: 16500,
  },
  {
    id: "sate-ayam",
    name: "Sate Ayam (10 Tusuk)",
    category: "makanan",
    keywords: ["sate ayam", "sate madura", "sate taichan"],
    minPrice: 18000,
    maxPrice: 28000,
    avgPrice: 23000,
  },
  {
    id: "indomie-warmindo",
    name: "Indomie Olahan / Warmindo",
    category: "makanan",
    keywords: ["indomie", "internet", "indomie rebus", "indomie goreng", "mie dok dok"],
    minPrice: 8000,
    maxPrice: 16000,
    avgPrice: 12000,
  },
  {
    id: "nasi-rames",
    name: "Nasi Rames / Sayur Komplit",
    category: "makanan",
    keywords: ["nasi rames", "nasi campur", "nasi uduk", "nasi kuning", "nasi padang"],
    minPrice: 12000,
    maxPrice: 20000,
    avgPrice: 15500,
  },
];

/**
 * Mencari kecocokan benchmark acuan harga berdasarkan nama menu & kategori.
 */
export function findPriceBenchmark(
  name: string,
  category?: "makanan" | "minuman",
): BenchmarkItem | null {
  const clean = name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .trim();
  if (!clean) return null;

  // 1. Coba pencocokan keyword terpanjang & paling spesifik dulu
  const candidates = FAIR_PRICE_BENCHMARKS.filter((b) => !category || b.category === category);

  let bestMatch: BenchmarkItem | null = null;
  let maxKeywordLen = 0;

  for (const item of candidates) {
    for (const kw of item.keywords) {
      if (clean.includes(kw) && kw.length > maxKeywordLen) {
        bestMatch = item;
        maxKeywordLen = kw.length;
      }
    }
  }

  return bestMatch;
}

export interface MenuItemPriceAnalysis {
  item: MenuItem;
  benchmark: BenchmarkItem | null;
  referenceAvg: number;
  diff: number;
  percentDiff: number;
  tier: PriceTier;
  label: string;
  badgeBg: string;
  badgeText: string;
}

/**
 * Analisis harga satu item menu terhadap acuan pasar dan rata-rata tetangga sekitar.
 */
export function analyzeMenuItemPrice(
  item: MenuItem,
  neighborItems?: MenuItem[],
): MenuItemPriceAnalysis {
  const benchmark = findPriceBenchmark(item.name, item.category);

  // Jika ada tetangga dengan menu serupa, campurkan datanya
  let referenceAvg: number;
  if (benchmark) {
    referenceAvg = benchmark.avgPrice;
    if (neighborItems && neighborItems.length > 0) {
      const similarNeighbors = neighborItems.filter(
        (n) => n.id !== item.id && findPriceBenchmark(n.name, n.category)?.id === benchmark.id,
      );
      if (similarNeighbors.length > 0) {
        const neighborSum = similarNeighbors.reduce((acc, n) => acc + n.price, 0);
        const neighborAvg = neighborSum / similarNeighbors.length;
        // 60% harga tetangga riil + 40% benchmark acuan
        referenceAvg = Math.round(neighborAvg * 0.6 + benchmark.avgPrice * 0.4);
      }
    }
  } else {
    // Fallback acuan kategori umum jika nama menu tidak ada di kamus
    referenceAvg = item.category === "minuman" ? 5000 : 16000;
  }

  const diff = item.price - referenceAvg;
  const percentDiff = referenceAvg > 0 ? Math.round((diff / referenceAvg) * 100) : 0;

  let tier: PriceTier;
  let label: string;
  let badgeBg: string;
  let badgeText: string;

  if (percentDiff <= -15) {
    tier = "cheap";
    const abs = Math.abs(percentDiff);
    label = `Hemat ${abs}%`;
    badgeBg = "bg-emerald-500/10 border-emerald-500/20";
    badgeText = "text-emerald-400";
  } else if (percentDiff <= 15) {
    tier = "fair";
    label = "Wajar Pasaran";
    badgeBg = "bg-primary/10 border-primary/25";
    badgeText = "text-primary";
  } else if (percentDiff < 40) {
    tier = "high";
    label = `+${percentDiff}% dari pasar`;
    badgeBg = "bg-amber-500/15 border-amber-500/30";
    badgeText = "text-amber-400";
  } else {
    tier = "overpriced";
    label = `Waspada +${percentDiff}%`;
    badgeBg = "bg-rose-500/15 border-rose-500/30";
    badgeText = "text-rose-400";
  }

  return {
    item,
    benchmark,
    referenceAvg,
    diff,
    percentDiff,
    tier,
    label,
    badgeBg,
    badgeText,
  };
}

export interface WarungPriceRadar {
  tier: PriceTier;
  score: number; // 0-100 (makin tinggi makin ramah kantong & wajar)
  title: string;
  description: string;
  averagePrice: number;
  analyzedCount: number;
  totalMenuCount: number;
  hasVerifiedReceipts: boolean;
  receiptCount: number;
  highestMarkupItem: MenuItemPriceAnalysis | null;
  lowestPriceItem: MenuItemPriceAnalysis | null;
  analyses: MenuItemPriceAnalysis[];
}

/**
 * Menghitung keseluruhan skor kewajaran harga dan potensi getok harga untuk warung.
 */
export function calculateWarungPriceRadar(
  warung: Warung,
  options: {
    neighborWarungs?: Warung[];
    receiptCount?: number;
  } = {},
): WarungPriceRadar {
  const { neighborWarungs = [], receiptCount = 0 } = options;

  const validMenu = (warung.menu || []).filter((m) => typeof m.price === "number" && m.price > 0);

  const neighborItems = neighborWarungs.flatMap((w) => w.menu || []);

  const analyses = validMenu.map((m) => analyzeMenuItemPrice(m, neighborItems));

  const totalMenuCount = (warung.menu || []).length;
  const analyzedCount = analyses.length;

  if (analyzedCount === 0) {
    return {
      tier: "fair",
      score: 75,
      title: "Data Harga Belum Tersedia",
      description: "Belum ada daftar menu atau harga yang dilaporkan pembeli untuk warung ini.",
      averagePrice: 0,
      analyzedCount: 0,
      totalMenuCount,
      hasVerifiedReceipts: receiptCount > 0,
      receiptCount,
      highestMarkupItem: null,
      lowestPriceItem: null,
      analyses: [],
    };
  }

  const avgPrice = Math.round(analyses.reduce((acc, a) => acc + a.item.price, 0) / analyzedCount);

  const avgPercentDiff = Math.round(
    analyses.reduce((acc, a) => acc + a.percentDiff, 0) / analyzedCount,
  );

  // Cari item dengan markup tertinggi dan harga paling hemat
  const sortedByDiff = [...analyses].sort((a, b) => b.percentDiff - a.percentDiff);
  const highestMarkup = sortedByDiff[0] ?? null;
  const lowestPrice = sortedByDiff[sortedByDiff.length - 1] ?? null;

  // Cek apakah ada indikasi getok harga:
  // 1. Rata-rata keseluruhan >= +35% di atas pasar, ATAU
  // 2. Ada menu primer (terutama minuman/makanan harian) yang dimarkup >= +65%
  const hasExtremeItem = highestMarkup && highestMarkup.percentDiff >= 65;

  let tier: PriceTier;
  let score: number;
  let title: string;
  let description: string;

  if (avgPercentDiff >= 35 || hasExtremeItem) {
    tier = "overpriced";
    score = Math.max(15, Math.round(50 - avgPercentDiff * 0.4));
    title = "Waspada Potensi Getok Harga";
    if (hasExtremeItem && highestMarkup) {
      description = `Terindikasi harga ${highestMarkup.item.name} (+${highestMarkup.percentDiff}%) jauh di atas pasaran rata-rata. Pastikan cek daftar harga sebelum memesan.`;
    } else {
      description = `Rata-rata harga menu terpantau ${avgPercentDiff}% lebih tinggi dibandingkan standar warung sejenis di kawasan ini.`;
    }
  } else if (avgPercentDiff > 15) {
    tier = "high";
    score = Math.max(50, Math.round(70 - avgPercentDiff * 0.5));
    title = "Sedikit di Atas Rata-rata";
    description = `Rata-rata harga menu berkisar Rp ${avgPrice.toLocaleString("id-ID")} (+${avgPercentDiff}% dari pasar). Cocok untuk porsi lebih besar atau tempat dine-in.`;
  } else if (avgPercentDiff <= -12) {
    tier = "cheap";
    score = 95;
    title = "Sangat Ramah Kantong";
    const abs = Math.abs(avgPercentDiff);
    description = `Harga rata-rata ${abs}% lebih hemat dibanding pasar. Pilihan favorit mahasiswa dan pekerja harian.`;
  } else {
    tier = "fair";
    score = 85;
    title = "Harga Wajar Pasaran";
    description = `Harga menu rata-rata Rp ${avgPrice.toLocaleString("id-ID")}, sesuai standar harga kuliner wajar di daerah sekitar.`;
  }

  return {
    tier,
    score,
    title,
    description,
    averagePrice: avgPrice,
    analyzedCount,
    totalMenuCount,
    hasVerifiedReceipts: receiptCount > 0,
    receiptCount,
    highestMarkupItem: highestMarkup,
    lowestPriceItem: lowestPrice,
    analyses,
  };
}
