import React, { useEffect, useState } from "react";
import { Clock, Flame, History, MapPin, Search, Store, X } from "lucide-react";
import { toast } from "sonner";
import type { GeoPlace } from "@/lib/places";
import {
  POPULAR_FOOD_QUERIES,
  addRecentSearch,
  clearRecentSearches,
  getRecentSearches,
  removeRecentSearch,
} from "@/lib/search-history";
import type { MenuItem, Warung } from "@/lib/warung-data";

export type SearchHit = { w: Warung; item: MenuItem | null };
export type Remote<T> = { status: "idle" | "loading" | "ok" | "error"; items: T[] };

export interface SearchApi {
  open: boolean;
  setOpen: (v: boolean) => void;
  places: Remote<GeoPlace>;
  hits: SearchHit[];
  pickPlace: (p: GeoPlace) => void;
  pickWarung: (id: string) => void;
  submit: () => void;
}

export function IconBtn({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      aria-label={label}
      onClick={onClick}
      className="grid h-12 w-12 place-items-center active:bg-accent"
    >
      {children}
    </button>
  );
}

export function ResultRow({
  icon,
  title,
  sub,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  sub: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={false}
      onClick={onClick}
      className="grid w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-white/5 active:bg-accent"
    >
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-muted/80 text-muted-foreground">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-foreground">{title}</span>
        {sub && <span className="block truncate text-xs text-muted-foreground">{sub}</span>}
      </span>
    </button>
  );
}

export function SearchDropdown({
  q,
  setQ,
  search,
}: {
  q: string;
  setQ: (v: string) => void;
  search: SearchApi;
}) {
  const { places, hits } = search;
  const isQueryEmpty = q.trim().length === 0;
  const tooShort = q.trim().length > 0 && q.trim().length < 3;

  const [history, setHistory] = useState<string[]>([]);

  useEffect(() => {
    setHistory(getRecentSearches());
  }, [search.open]);

  const handleSelectRecent = (query: string) => {
    setQ(query);
    addRecentSearch(query);
    setHistory(getRecentSearches());
  };

  const handleRemoveRecent = (e: React.MouseEvent, query: string) => {
    e.stopPropagation();
    const updated = removeRecentSearch(query);
    setHistory(updated);
  };

  const handleClearAllHistory = (e: React.MouseEvent) => {
    e.stopPropagation();
    clearRecentSearches();
    setHistory([]);
    toast.success("Riwayat pencarian dibersihkan");
  };

  return (
    <div
      role="listbox"
      className="absolute inset-x-0 top-full z-50 mt-2 max-h-[60dvh] overflow-y-auto overscroll-contain rounded-2xl border border-white/10 bg-card p-3 shadow-float"
    >
      {isQueryEmpty ? (
        <div className="space-y-3">
          {/* Kuliner Populer / Pencarian Cepat */}
          <div>
            <div className="mb-2 flex items-center gap-1.5 px-1 text-xs font-semibold text-muted-foreground">
              <Flame className="h-3.5 w-3.5 text-amber-400" />
              <span>Pencarian Cepat</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {POPULAR_FOOD_QUERIES.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => handleSelectRecent(item.label)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-foreground transition-colors hover:border-white/20 hover:bg-white/10 active:scale-95"
                >
                  <span>{item.emoji}</span>
                  <span className="font-medium">{item.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Riwayat Pencarian Terakhir */}
          {history.length > 0 && (
            <div>
              <div className="mb-1 flex items-center justify-between px-1 text-xs font-semibold text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <History className="h-3.5 w-3.5 text-primary" />
                  <span>Riwayat Terakhir</span>
                </div>
                <button
                  type="button"
                  onClick={handleClearAllHistory}
                  className="text-[11px] font-normal text-muted-foreground/80 hover:text-foreground transition-colors"
                >
                  Hapus semua
                </button>
              </div>
              <div className="space-y-0.5">
                {history.map((item) => (
                  <div
                    key={item}
                    role="option"
                    aria-selected={false}
                    onClick={() => handleSelectRecent(item)}
                    className="flex cursor-pointer items-center justify-between rounded-xl px-2.5 py-2 transition-colors hover:bg-white/5 active:bg-white/10"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate text-sm text-foreground">{item}</span>
                    </div>
                    <button
                      type="button"
                      aria-label={`Hapus ${item} dari riwayat`}
                      onClick={(e) => handleRemoveRecent(e, item)}
                      className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-white/10 hover:text-foreground active:scale-90"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {history.length === 0 && (
            <p className="px-1 py-1 text-xs text-muted-foreground/70">
              Ketik nama tempat, nama warung, atau menu makanan favoritmu.
            </p>
          )}
        </div>
      ) : (
        <>
          {hits.length > 0 && (
            <>
              <p className="px-3 pb-1 pt-2 text-xs font-semibold text-muted-foreground">
                Warung & menu
              </p>
              {hits.map(({ w, item }) => (
                <ResultRow
                  key={w.id}
                  icon={<Store className="h-4 w-4 text-amber-400" />}
                  title={w.name}
                  sub={
                    item
                      ? `${item.name} (Rp ${item.price.toLocaleString("id-ID")}) · ${w.category}`
                      : w.category
                  }
                  onClick={() => {
                    addRecentSearch(w.name);
                    search.pickWarung(w.id);
                  }}
                />
              ))}
            </>
          )}
          <p className="px-3 pb-1 pt-2 text-xs font-semibold text-muted-foreground">
            Tempat di peta
          </p>
          {places.items.map((p) => (
            <ResultRow
              key={p.id}
              icon={<MapPin className="h-4 w-4 text-primary" />}
              title={p.name}
              sub={p.detail}
              onClick={() => {
                addRecentSearch(p.name);
                search.pickPlace(p);
              }}
            />
          ))}
          {places.items.length === 0 && (
            <p className="px-3 py-3 text-sm text-muted-foreground">
              {tooShort
                ? "Ketik minimal 3 huruf untuk mencari tempat."
                : places.status === "error"
                  ? "Gagal mencari tempat. Cek koneksi lalu coba lagi."
                  : places.status === "loading" || places.status === "idle"
                    ? "Mencari tempat…"
                    : `Tempat "${q.trim()}" tidak ditemukan.`}
            </p>
          )}
        </>
      )}
    </div>
  );
}

export function TopBar({
  q,
  setQ,
  search,
}: {
  q: string;
  setQ: (v: string) => void;
  user?: { name: string; ownerOf: string | null } | null;
  search: SearchApi;
}) {
  const showDropdown = search.open;
  return (
    <div className="relative" data-search-root>
      <label className="flex h-10 min-w-0 items-center gap-2.5 rounded-xl border border-white/10 bg-[#262626] px-3 transition-colors focus-within:border-white/30">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            search.setOpen(true);
          }}
          onFocus={() => search.setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") search.submit();
            if (e.key === "Escape") search.setOpen(false);
          }}
          enterKeyHint="search"
          autoComplete="off"
          placeholder="Cari tempat, warung, atau menu"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
        />
        {q && (
          <button
            type="button"
            aria-label="Hapus teks pencarian"
            onClick={() => setQ("")}
            className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:text-foreground active:scale-95"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </label>
      {showDropdown && <SearchDropdown q={q} setQ={setQ} search={search} />}
    </div>
  );
}
