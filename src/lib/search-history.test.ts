import { beforeEach, describe, expect, it } from "vitest";
import {
  POPULAR_FOOD_QUERIES,
  addRecentSearch,
  clearRecentSearches,
  getRecentSearches,
  removeRecentSearch,
} from "./search-history";

describe("search-history", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("mengembalikan array kosong jika belum ada riwayat", () => {
    expect(getRecentSearches()).toEqual([]);
  });

  it("menambahkan query ke riwayat dan menaruhnya di urutan teratas", () => {
    addRecentSearch("Mie Ayam");
    addRecentSearch("Kopi Tubruk");
    expect(getRecentSearches()).toEqual(["Kopi Tubruk", "Mie Ayam"]);
  });

  it("menghindari duplikasi case-insensitive dan memindahkan ke urutan teratas", () => {
    addRecentSearch("Mie Ayam");
    addRecentSearch("Ayam Geprek");
    addRecentSearch("mie ayam");
    expect(getRecentSearches()).toEqual(["mie ayam", "Ayam Geprek"]);
  });

  it("membatasi riwayat maksimal 6 item", () => {
    for (let i = 1; i <= 10; i++) {
      addRecentSearch(`Menu ${i}`);
    }
    const history = getRecentSearches();
    expect(history.length).toBe(6);
    expect(history[0]).toBe("Menu 10");
  });

  it("menghapus satu item tertentu dari riwayat", () => {
    addRecentSearch("Bakso");
    addRecentSearch("Soto");
    addRecentSearch("Rawon");
    removeRecentSearch("Soto");
    expect(getRecentSearches()).toEqual(["Rawon", "Bakso"]);
  });

  it("membersihkan semua riwayat pencarian", () => {
    addRecentSearch("Es Teh");
    addRecentSearch("Jus Alpukat");
    clearRecentSearches();
    expect(getRecentSearches()).toEqual([]);
  });

  it("memiliki daftar kuliner populer bawaan", () => {
    expect(POPULAR_FOOD_QUERIES.length).toBeGreaterThan(0);
    expect(POPULAR_FOOD_QUERIES.some((q) => q.label.includes("Mie Ayam"))).toBe(true);
  });
});
