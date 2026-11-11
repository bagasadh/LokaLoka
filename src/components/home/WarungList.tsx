import { Link } from "@tanstack/react-router";
import { CreditCard, Heart, Receipt, ShieldAlert, ShieldCheck, Store } from "lucide-react";
import { toast } from "sonner";
import { Stars } from "@/components/WarungBits";
import { calculateWarungPriceRadar } from "@/lib/price-radar";
import { actions } from "@/lib/store";
import {
  OPEN_LABEL,
  PLACEHOLDER_COVER,
  WARUNGS,
  getRepresentativeItem,
  getScheduleInsight,
  type OpenState,
  type Review,
  type Warung,
} from "@/lib/warung-data";
import type { Remote } from "./SearchDropdown";

export function WarungList({
  list,
  selected,
  onSelect,
  status,
  onRetry,
  reviews = [],
  bookmarks = [],
}: {
  list: { w: Warung; dist: number; rating: { avg: number; count: number }; state: OpenState }[];
  selected: string | null;
  onSelect: (id: string | null) => void;
  status: Remote<Warung>["status"];
  onRetry: () => void;
  reviews?: Review[];
  bookmarks?: string[];
}) {
  const loading = status === "loading" || status === "idle";
  const note = loading ? (
    <p className="py-2 text-xs text-muted-foreground">Mencari warung di sekitar…</p>
  ) : status === "error" ? (
    <p className="flex flex-wrap items-center gap-x-2 py-2 text-xs text-muted-foreground">
      Gagal memuat warung dari peta.
      <button onClick={onRetry} className="font-semibold text-foreground underline">
        Coba lagi
      </button>
    </p>
  ) : null;

  if (!list.length)
    return (
      <div className="grid place-items-center gap-2 py-10 text-center text-sm text-muted-foreground">
        <Store className="h-8 w-8 text-muted-foreground" />
        {loading ? (
          "Mencari warung di sekitar…"
        ) : (
          <>
            <p>
              {status === "error"
                ? "Gagal memuat warung dari peta."
                : "Belum ada warung yang sesuai dengan filter."}
            </p>
            {status === "error" ? (
              <button onClick={onRetry} className="font-semibold text-foreground underline">
                Coba lagi
              </button>
            ) : (
              <p className="max-w-xs text-xs text-muted-foreground">
                Coba ubah filter budget atau kategori untuk melihat warung lainnya.
              </p>
            )}
          </>
        )}
      </div>
    );
  return (
    <>
      {note}
      <ul className="divide-y divide-border">
        {list.map(({ w, rating, state }) => {
          const hasReceipt = reviews.some((r) => r.warungId === w.id && !!r.receipt);
          const priceRadar = calculateWarungPriceRadar(w, { neighborWarungs: WARUNGS });
          const rep = getRepresentativeItem(w);
          const minPrice = rep.price;
          const isFav = bookmarks.includes(w.id);
          const timing = getScheduleInsight(w);

          return (
            <li key={w.id}>
              <div
                className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3 transition-colors ${
                  selected === w.id ? "opacity-100" : ""
                }`}
              >
                <button
                  onClick={() => onSelect(selected === w.id ? null : w.id)}
                  className="min-w-0 text-left"
                >
                  <div className="flex items-center gap-1.5">
                    <p className="truncate font-display font-semibold text-foreground">{w.name}</p>
                    {isFav && <Heart className="h-3 w-3 shrink-0 fill-rose-500 text-rose-500" />}
                  </div>
                  <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                    {rating.avg > 0 ? (
                      <>
                        <span className="shrink-0 font-bold text-foreground">
                          {rating.avg.toFixed(1)}
                        </span>
                        <Stars value={rating.avg} size={11} />
                        <span className="shrink-0">({rating.count})</span>
                        <span className="truncate">· {w.category}</span>
                      </>
                    ) : (
                      <span className="truncate">{w.category}</span>
                    )}
                    {minPrice && (
                      <span className="shrink-0 text-muted-foreground">
                        · Mulai{" "}
                        <span className="font-medium text-foreground">
                          Rp {minPrice.toLocaleString("id-ID")}
                        </span>
                      </span>
                    )}
                  </div>

                  <div className="mt-1.5 flex flex-wrap items-center gap-1 text-xs">
                    <span className={`text-[11px] font-medium ${OPEN_LABEL[state].cls}`}>
                      {state === "unknown" ? "Jam buka belum tercatat" : OPEN_LABEL[state].text}
                    </span>
                    {timing.isClosingSoon && (
                      <span className="inline-flex items-center rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">
                        <span>Tutup {timing.minutesLeft} mnt lagi</span>
                      </span>
                    )}
                    {priceRadar.tier === "cheap" && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-300">
                        <ShieldCheck className="h-2.5 w-2.5" />
                        <span>Ramah Kantong</span>
                      </span>
                    )}
                    {priceRadar.tier === "fair" && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/12 px-1.5 py-0.5 text-[10px] font-medium text-emerald-300/90">
                        <ShieldCheck className="h-2.5 w-2.5" />
                        <span>Harga Wajar</span>
                      </span>
                    )}
                    {priceRadar.tier === "overpriced" && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-medium text-rose-300">
                        <ShieldAlert className="h-2.5 w-2.5" />
                        <span>Waspada Getok</span>
                      </span>
                    )}
                    {w.hasQris && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-white/[0.07] px-1.5 py-0.5 text-[10px] font-medium text-foreground/85">
                        <CreditCard className="h-2.5 w-2.5 text-muted-foreground" />
                        <span>QRIS</span>
                      </span>
                    )}
                    {timing.isLateNight && (
                      <span className="inline-flex items-center rounded-md bg-white/[0.07] px-1.5 py-0.5 text-[10px] font-medium text-foreground/85">
                        <span>Buka Malam</span>
                      </span>
                    )}
                    {hasReceipt && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-white/[0.07] px-1.5 py-0.5 text-[10px] font-medium text-foreground/85">
                        <Receipt className="h-2.5 w-2.5 text-muted-foreground" />
                        <span>Ada Struk</span>
                      </span>
                    )}
                    {w.registered && (
                      <span className="inline-flex items-center rounded-md bg-white/[0.07] px-1.5 py-0.5 text-[10px] font-medium text-foreground/85">
                        <span>Terverifikasi</span>
                      </span>
                    )}
                  </div>
                </button>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    aria-label={isFav ? "Hapus dari favorit" : "Simpan ke favorit"}
                    onClick={() => {
                      const added = actions.toggleBookmark(w.id);
                      toast.success(
                        added ? `"${w.name}" disimpan ke favorit` : "Dihapus dari favorit",
                      );
                    }}
                    className="grid h-8 w-8 place-items-center rounded-lg bg-white/5 text-muted-foreground transition hover:bg-white/10 hover:text-foreground active:scale-90"
                    title={isFav ? "Hapus dari favorit" : "Simpan ke favorit"}
                  >
                    <Heart
                      className={`h-4 w-4 ${isFav ? "fill-rose-500 text-rose-500" : "text-muted-foreground"}`}
                    />
                  </button>
                  <Link to="/warung/$id" params={{ id: w.id }} className="shrink-0">
                    <img
                      src={w.cover || PLACEHOLDER_COVER}
                      alt={w.name}
                      loading="lazy"
                      className="h-16 w-16 rounded-xl object-cover sm:h-20 sm:w-20 bg-muted border border-white/5"
                    />
                  </Link>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
