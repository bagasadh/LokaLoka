import React from "react";
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Heart,
  Loader2,
  LocateFixed,
  Receipt,
  ShieldAlert,
  ShieldCheck,
  Store,
} from "lucide-react";
import { toast } from "sonner";
import { Stars } from "@/components/WarungBits";
import { calculateWarungPriceRadar } from "@/lib/price-radar";
import { actions, isBookmarked, useStore } from "@/lib/store";
import {
  OPEN_LABEL,
  PLACEHOLDER_COVER,
  WARUNGS,
  formatDistance,
  getRepresentativeItem,
  getScheduleInsight,
  hoursLabel,
  type OpenState,
  type Warung,
} from "@/lib/warung-data";
import type { Filter } from "./Chips";
import type { Remote } from "./SearchDropdown";
import { WarungList } from "./WarungList";

export interface WarungCarouselProps {
  mobileView: "carousel" | "list";
  setMobileView: (v: "carousel" | "list") => void;
  areaTitle: string;
  list: { w: Warung; dist: number; rating: { avg: number; count: number }; state: OpenState }[];
  selected: string | null;
  onSelect: (id: string | null) => void;
  nearby: Remote<Warung>;
  setRetry: React.Dispatch<React.SetStateAction<number>>;
  onOpenGacha: () => void;
  pinStyle: "badge" | "compact";
  togglePinStyle: () => void;
  goHome: () => void;
  cardRefs: React.MutableRefObject<Record<string, HTMLElement | null>>;
  filters: Filter[];
  now: Date;
  onNavigateToWarung: (id: string) => void;
  isTransparent?: boolean;
  onToggleTransparent?: () => void;
}

export function WarungCarousel({
  mobileView,
  setMobileView,
  areaTitle,
  list,
  selected,
  onSelect,
  nearby,
  setRetry,
  onOpenGacha,
  pinStyle,
  togglePinStyle,
  goHome,
  cardRefs,
  filters,
  now,
  onNavigateToWarung,
  isTransparent,
  onToggleTransparent,
}: WarungCarouselProps) {
  const s = useStore();

  return (
    <div className="lg:hidden">
      {mobileView === "list" ? (
        <>
          <div
            className="fixed inset-0 z-30 bg-black/60 backdrop-blur-xs transition-opacity lg:hidden"
            onClick={() => setMobileView("carousel")}
            aria-hidden="true"
          />
          <div className="fixed inset-x-0 bottom-dock z-30 flex max-h-[80dvh] flex-col rounded-t-3xl border-t border-white/10 bg-background shadow-float transition-all duration-300 lg:hidden">
            <div className="flex shrink-0 items-center justify-between border-b border-white/5 px-4 py-3">
              <div className="flex min-w-0 items-center gap-2">
                <Store className="h-4 w-4 shrink-0 text-amber-400" />
                <span className="truncate font-display text-base font-bold text-foreground">
                  {areaTitle}
                </span>
                <span className="shrink-0 text-sm font-semibold text-muted-foreground">
                  ({list.length})
                </span>
              </div>
              <button
                aria-label="Tutup daftar"
                onClick={() => setMobileView("carousel")}
                className="grid h-8 w-8 place-items-center rounded-full bg-card text-muted-foreground transition-transform hover:text-foreground active:scale-95"
              >
                <ChevronDown className="h-5 w-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-2">
              <WarungList
                list={list}
                selected={selected}
                onSelect={(id) => {
                  onSelect(id);
                  setMobileView("carousel");
                }}
                status={nearby.status}
                onRetry={() => setRetry((r) => r + 1)}
                reviews={s.reviews}
                bookmarks={s.bookmarks}
              />
            </div>
          </div>
        </>
      ) : (
        <div
          className={`absolute inset-x-0 bottom-dock z-30 pt-1 pb-1 transition-all duration-300 ease-in-out ${
            isTransparent
              ? "translate-y-full opacity-0 pointer-events-none"
              : "translate-y-0 opacity-100"
          }`}
        >
          {/* Bar di atas carousel: Info warung di kiri, Tombol GPS di kanan */}
          <div className="mx-3 mb-2 flex items-center justify-between gap-2">
            {list.length > 0 ? (
              <div className="flex min-w-0 flex-1 items-center justify-between rounded-full border border-white/10 bg-[#242424]/95 px-3.5 py-1.5 shadow-float backdrop-blur-md">
                <div className="flex min-w-0 flex-1 items-center gap-1.5 pr-2">
                  <Store className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                  <span className="truncate font-display text-xs font-semibold text-foreground">
                    {areaTitle}
                  </span>
                  <span className="shrink-0 text-xs font-medium text-muted-foreground">
                    · {list.length}
                  </span>
                  {nearby.status === "loading" && (
                    <Loader2 className="h-3 w-3 animate-spin text-amber-400 shrink-0" />
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {nearby.status === "error" && (
                    <button
                      type="button"
                      onClick={() => setRetry((r) => r + 1)}
                      className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-300 hover:bg-amber-500/25 active:scale-95"
                    >
                      Coba lagi
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setMobileView("list")}
                    className="flex items-center gap-1 rounded-full bg-white/5 px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground active:scale-95"
                  >
                    <span>Daftar</span>
                    <ChevronUp className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex-1" />
            )}

            {/* Tombol Map Control (Lokasi Saya) */}
            <button
              type="button"
              aria-label="Lokasi saya"
              onClick={goHome}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/10 bg-[#242424]/95 text-locate shadow-float backdrop-blur-md transition-transform active:scale-90"
              title="Pusatkan peta ke lokasi saya"
            >
              <LocateFixed className="h-4 w-4" />
            </button>
          </div>

          {/* Horizontal cards container */}
          <div className="no-scrollbar flex gap-3 overflow-x-auto px-3 pb-1 pt-0.5 snap-x snap-mandatory scroll-smooth">
            {list.length > 0 ? (
              list.map(({ w, dist, rating, state }) => {
                const isSelected = w.id === selected;
                const hasReceipt = s.reviews.some((r) => r.warungId === w.id && !!r.receipt);
                const priceRadar = calculateWarungPriceRadar(w, {
                  neighborWarungs: WARUNGS,
                });
                const rep = getRepresentativeItem(
                  w,
                  filters.includes("Minuman") ? "minuman" : undefined,
                );
                const minPrice = rep.price;
                const timing = getScheduleInsight(w, now);

                return (
                  <article
                    key={w.id}
                    ref={(node) => {
                      if (node) cardRefs.current[w.id] = node;
                      else delete cardRefs.current[w.id];
                    }}
                    onClick={() => onSelect(isSelected ? null : w.id)}
                    className={`flex w-[80vw] max-w-[305px] shrink-0 snap-center cursor-pointer flex-col justify-between rounded-3xl bg-card/95 p-3 shadow-float border backdrop-blur-sm transition-all duration-200 active:scale-[0.99] ${
                      isSelected
                        ? "border-primary ring-2 ring-primary/40 bg-card"
                        : "border-white/10 hover:border-white/20"
                    }`}
                  >
                    <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-2.5">
                      <img
                        src={w.cover || PLACEHOLDER_COVER}
                        alt={w.name}
                        onClick={(e) => {
                          e.stopPropagation();
                          onNavigateToWarung(w.id);
                        }}
                        className="h-18 w-18 shrink-0 rounded-2xl object-cover bg-muted border border-white/5 hover:opacity-90 transition-opacity"
                        title="Buka profil warung"
                      />
                      <div className="min-w-0">
                        <div className="flex items-start justify-between gap-1.5">
                          <p
                            onClick={(e) => {
                              e.stopPropagation();
                              onNavigateToWarung(w.id);
                            }}
                            className="truncate font-display text-sm font-bold text-foreground hover:text-primary transition-colors"
                            title="Buka profil warung"
                          >
                            {w.name}
                          </p>
                          <div className="flex shrink-0 items-center gap-1">
                            <button
                              type="button"
                              aria-label={
                                isBookmarked(s, w.id) ? "Hapus dari favorit" : "Simpan ke favorit"
                              }
                              onClick={(e) => {
                                e.stopPropagation();
                                const added = actions.toggleBookmark(w.id);
                                toast.success(
                                  added
                                    ? `"${w.name}" disimpan ke favorit ❤️`
                                    : "Dihapus dari favorit",
                                );
                              }}
                              className="grid h-6 w-6 place-items-center rounded-full bg-white/10 text-muted-foreground transition hover:bg-white/20 active:scale-90"
                              title={
                                isBookmarked(s, w.id) ? "Hapus dari favorit" : "Simpan ke favorit"
                              }
                            >
                              <Heart
                                className={`h-3.5 w-3.5 ${
                                  isBookmarked(s, w.id)
                                    ? "fill-rose-500 text-rose-500"
                                    : "text-muted-foreground hover:text-foreground"
                                }`}
                              />
                            </button>
                            <span
                              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                state === "open"
                                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                                  : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {OPEN_LABEL[state].text}
                            </span>
                            {timing.isClosingSoon && (
                              <span className="shrink-0 rounded-full border border-amber-500/30 bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-amber-300">
                                ⏳ Tutup {timing.minutesLeft}m
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span className="shrink-0 font-bold text-foreground">
                            {rating.avg ? rating.avg.toFixed(1) : "–"}
                          </span>
                          <Stars value={rating.avg} size={11} />
                          <span className="truncate">· {formatDistance(dist)}</span>
                        </div>

                        <div className="mt-1 flex flex-wrap items-center gap-1">
                          {w.hasQris && (
                            <span className="inline-flex items-center gap-0.5 rounded border border-cyan-500/30 bg-cyan-500/10 px-1.5 py-0.5 text-[9px] font-medium text-cyan-300">
                              <CreditCard className="h-2.5 w-2.5" />
                              <span>QRIS</span>
                            </span>
                          )}
                          {timing.isLateNight && (
                            <span className="inline-flex items-center gap-0.5 rounded border border-indigo-500/30 bg-indigo-500/10 px-1.5 py-0.5 text-[9px] font-medium text-indigo-300">
                              <span>🌙 Malam</span>
                            </span>
                          )}
                          {priceRadar.tier === "cheap" && (
                            <span className="inline-flex items-center gap-0.5 rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-medium text-emerald-300">
                              <span>🟢 Ramah Kantong</span>
                            </span>
                          )}
                          {priceRadar.tier === "fair" && (
                            <span className="inline-flex items-center gap-0.5 rounded border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium text-primary">
                              <ShieldCheck className="h-2.5 w-2.5" />
                              <span>Harga Wajar</span>
                            </span>
                          )}
                          {priceRadar.tier === "overpriced" && (
                            <span className="inline-flex items-center gap-0.5 rounded border border-rose-500/30 bg-rose-500/10 px-1.5 py-0.5 text-[9px] font-medium text-rose-300">
                              <ShieldAlert className="h-2.5 w-2.5" />
                              <span>Waspada Getok</span>
                            </span>
                          )}
                          {hasReceipt && (
                            <span className="inline-flex items-center gap-0.5 rounded border border-white/15 bg-white/10 px-1.5 py-0.5 text-[9px] font-medium text-foreground">
                              <Receipt className="h-2.5 w-2.5 text-sky-400" />
                              <span>Ada Struk</span>
                            </span>
                          )}
                          {w.registered && (
                            <span className="inline-flex items-center gap-0.5 rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-medium text-amber-300">
                              <CheckCircle2 className="h-2.5 w-2.5 text-amber-400" />
                              <span>Harga Pemilik</span>
                            </span>
                          )}
                          {!hasReceipt && !w.registered && priceRadar.totalMenuCount === 0 && (
                            <span className="truncate text-[10px] text-muted-foreground">
                              {w.category}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-2 flex items-center justify-between border-t border-white/5 pt-1.5">
                      <div className="min-w-0">
                        {minPrice ? (
                          <p className="truncate text-xs font-semibold text-foreground">
                            Mulai{" "}
                            <span className="text-amber-300">
                              Rp {minPrice.toLocaleString("id-ID")}
                            </span>
                          </p>
                        ) : (
                          <p className="truncate text-[11px] text-muted-foreground">
                            {hoursLabel(w)}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onNavigateToWarung(w.id);
                        }}
                        className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground transition-transform hover:bg-primary/90 active:scale-95"
                        title="Buka profil & menu warung ini"
                      >
                        <span>Lihat profil</span>
                        <ArrowRight className="h-3 w-3" />
                      </button>
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="mx-auto w-[calc(100vw-2rem)] max-w-sm rounded-3xl border border-white/10 bg-[#242424]/95 p-5 text-center shadow-float backdrop-blur-md">
                <div className="grid place-items-center gap-2 py-2 text-sm text-muted-foreground">
                  <Store className="h-8 w-8 text-muted-foreground/70" />
                  {nearby.status === "loading" || nearby.status === "idle" ? (
                    <p className="font-medium text-foreground">Mencari warung di sekitar…</p>
                  ) : nearby.status === "error" ? (
                    <div className="flex flex-col items-center gap-2.5">
                      <p className="font-semibold text-foreground">
                        Gagal memuat warung dari peta.
                      </p>
                      <button
                        type="button"
                        onClick={() => setRetry((r) => r + 1)}
                        className="inline-flex items-center rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground shadow transition active:scale-95"
                      >
                        Coba lagi
                      </button>
                    </div>
                  ) : (
                    <>
                      <p className="font-medium text-foreground">
                        Belum ada warung yang terdeteksi di sekitar sini.
                      </p>
                      <p className="max-w-xs text-xs text-muted-foreground">
                        Data tempat makan berasal dari OpenStreetMap, jadi warung kecil bisa saja
                        belum terpetakan.
                      </p>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
