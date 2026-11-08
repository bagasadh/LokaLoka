/**
 * Pengelolaan Riwayat Pencarian & Rekomendasi Cepat Kuliner Lokaloka
 */

const STORAGE_KEY = "lokaloka_search_history_v1";
const MAX_HISTORY = 6;

export interface PopularFoodQuery {
  label: string;
  emoji: string;
  category: "makanan" | "minuman" | "all";
}

export const POPULAR_FOOD_QUERIES: readonly PopularFoodQuery[] = [
  { label: "Mie Ayam & Bakso", emoji: "🍜", category: "makanan" },
  { label: "Ayam Geprek", emoji: "🍗", category: "makanan" },
  { label: "Nasi Goreng", emoji: "🍚", category: "makanan" },
  { label: "Warkop & Kopi", emoji: "☕", category: "minuman" },
  { label: "Pecel Lele", emoji: "🐟", category: "makanan" },
  { label: "Es Teh & Jus", emoji: "🧋", category: "minuman" },
  { label: "Soto Ayam & Daging", emoji: "🍲", category: "makanan" },
  { label: "Nasi Padang", emoji: "🍛", category: "makanan" },
] as const;

export function getRecentSearches(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
      .slice(0, MAX_HISTORY);
  } catch {
    return [];
  }
}

export function addRecentSearch(query: string): string[] {
  const trimmed = query.trim();
  if (!trimmed || typeof window === "undefined") return getRecentSearches();
  try {
    const current = getRecentSearches().filter(
      (item) => item.toLowerCase() !== trimmed.toLowerCase(),
    );
    const updated = [trimmed, ...current].slice(0, MAX_HISTORY);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

export function removeRecentSearch(query: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const trimmed = query.trim().toLowerCase();
    const current = getRecentSearches().filter((item) => item.toLowerCase() !== trimmed);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    return current;
  } catch {
    return [];
  }
}

export function clearRecentSearches(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* abaikan */
  }
}
