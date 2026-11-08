import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Heart,
  LogOut,
  MessageSquareText,
  Receipt,
  Store,
  Trash2,
  User,
  Utensils,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { BottomNav } from "@/components/BottomNav";
import { Stars } from "@/components/WarungBits";
import { useGeo } from "@/lib/geo";
import { actions, getWarung, ratingOf, useStore } from "@/lib/store";
import {
  PLACEHOLDER_COVER,
  distanceKm,
  formatDistance,
  minPrice as getMinPrice,
  type Warung,
} from "@/lib/warung-data";

export const Route = createFileRoute("/profil")({
  validateSearch: (search: Record<string, unknown>): { tab?: "ulasan" | "favorit" } => {
    const rawTab = search["tab"];
    const tab =
      typeof rawTab === "string" && ["ulasan", "favorit"].includes(rawTab)
        ? (rawTab as "ulasan" | "favorit")
        : undefined;
    return tab ? { tab } : {};
  },
  head: () => ({
    meta: [
      { title: "Profil & Ulasan — Lokaloka" },
      {
        name: "description",
        content: "Profil pengguna, ulasan berstruk terverifikasi, dan warung favorit di Lokaloka.",
      },
      { property: "og:title", content: "Profil & Ulasan — Lokaloka" },
      { property: "og:type", content: "website" },
    ],
  }),
  component: ProfilPage,
});

type UlasanSubTab = "semua" | "saya";

function ProfilPage() {
  const s = useStore();
  const geo = useGeo();
  const navigate = useNavigate();
  const { tab: initialTab } = Route.useSearch();
  const [tab, setTab] = useState<"ulasan" | "favorit">(initialTab || "ulasan");
  const [ulasanSubTab, setUlasanSubTab] = useState<UlasanSubTab>("semua");
  const [selectedReceipt, setSelectedReceipt] = useState<string | null>(null);

  // Ulasan
  const allReviews = useMemo(
    () => [...s.reviews].sort((a, b) => b.createdAt - a.createdAt),
    [s.reviews],
  );
  const mineReviews = useMemo(
    () => (s.user ? allReviews.filter((r) => r.author === s.user!.name) : []),
    [allReviews, s.user],
  );
  const displayedReviews = ulasanSubTab === "saya" && s.user ? mineReviews : allReviews;

  // Warung favorit
  const bookmarkedWarungs = (s.bookmarks ?? [])
    .map((id) => getWarung(s, id))
    .filter((w): w is Warung => Boolean(w));

  return (
    <main className="mx-auto min-h-dvh w-full max-w-xl px-4 pt-safe pb-28 lg:pb-10">
      {/* Header bar */}
      <div className="flex items-center justify-between pt-3 pb-3">
        <Link
          to="/"
          aria-label="Kembali ke Peta"
          className="grid h-10 w-10 place-items-center rounded-full bg-card shadow-sm transition hover:bg-card/80 active:scale-95"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="font-display text-lg font-bold">Profil</h1>
        {s.user ? (
          <button
            type="button"
            onClick={() => {
              actions.logout();
              toast.success("Berhasil keluar dari akun");
            }}
            aria-label="Keluar"
            title="Keluar dari akun"
            className="grid h-10 w-10 place-items-center rounded-full bg-card text-muted-foreground shadow-sm transition hover:bg-destructive/10 hover:text-destructive active:scale-95"
          >
            <LogOut className="h-4 w-4" />
          </button>
        ) : (
          <div className="w-10" />
        )}
      </div>

      {/* Kartu Profil Pengguna */}
      {!s.user ? (
        <div className="rounded-3xl border border-white/10 bg-card p-5 text-center shadow-xs">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Store className="h-6 w-6" />
          </span>
          <p className="mt-3 font-display text-base font-bold text-foreground">Masuk ke Lokaloka</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Masuk untuk menyimpan warung favorit, menulis ulasan berstruk, atau mendaftarkan
            warungmu.
          </p>
          <Link
            to="/masuk"
            className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-full bg-primary px-5 text-xs font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 active:scale-95"
          >
            Masuk Sekarang
          </Link>
        </div>
      ) : (
        <div className="rounded-3xl border border-white/10 bg-card p-4 shadow-xs">
          <div className="flex items-center gap-3.5">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-primary font-display text-2xl font-bold text-primary-foreground shadow-inner">
              {s.user.name.charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="truncate font-display text-lg font-bold text-foreground">
                  {s.user.name}
                </h2>
                {s.user.ownerOf ? (
                  <span className="shrink-0 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                    👑 Pemilik
                  </span>
                ) : (
                  <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                    Warga Lokal
                  </span>
                )}
              </div>
              <p className="truncate text-xs text-muted-foreground">{s.user.email}</p>
              <div className="mt-1.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                <span>{mineReviews.length} ulasan ditulis</span>
                <span>·</span>
                <span>{bookmarkedWarungs.length} warung favorit</span>
              </div>
            </div>
          </div>

          {s.user.ownerOf && (
            <div className="mt-3.5 border-t border-white/5 pt-3">
              <Link
                to="/pemilik"
                className="flex h-10 items-center justify-between rounded-xl bg-white/5 px-3.5 text-xs font-semibold text-foreground transition hover:bg-white/10 active:scale-[0.99]"
              >
                <div className="flex items-center gap-2">
                  <Store className="h-4 w-4 text-amber-400" />
                  <span>Kelola Warung Saya</span>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Tab Navigasi Utama: Ulasan & Favorit */}
      <div className="mt-5 grid grid-cols-2 rounded-2xl border border-white/10 bg-card p-1">
        <button
          type="button"
          onClick={() => setTab("ulasan")}
          className={`flex h-10 items-center justify-center gap-2 rounded-xl text-xs font-semibold transition-all ${
            tab === "ulasan"
              ? "bg-foreground text-background shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Receipt className="h-3.5 w-3.5" />
          <span>Ulasan ({allReviews.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setTab("favorit")}
          className={`flex h-10 items-center justify-center gap-2 rounded-xl text-xs font-semibold transition-all ${
            tab === "favorit"
              ? "bg-foreground text-background shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Heart className="h-3.5 w-3.5 fill-current" />
          <span>Favorit ({bookmarkedWarungs.length})</span>
        </button>
      </div>

      {/* Konten Tab Ulasan */}
      {tab === "ulasan" && (
        <section className="mt-4 space-y-3">
          {/* Subfilter & edukasi */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1 rounded-full border border-sky-400/30 bg-sky-400/10 px-2.5 py-1 text-[11px] font-semibold text-sky-300">
              <Receipt className="h-3 w-3" />
              Semua ulasan wajib bukti struk
            </span>

            {s.user && (
              <div className="inline-flex rounded-full border border-white/10 bg-[#262626] p-0.5">
                {(["semua", "saya"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setUlasanSubTab(t)}
                    className={`h-7 rounded-full px-3 text-[11px] font-semibold transition-colors ${
                      ulasanSubTab === t ? "bg-foreground text-background" : "text-muted-foreground"
                    }`}
                  >
                    {t === "semua" ? "Semua" : `Ulasan Saya (${mineReviews.length})`}
                  </button>
                ))}
              </div>
            )}
          </div>

          {displayedReviews.length === 0 ? (
            <div className="rounded-3xl border border-white/10 bg-card/60 px-4 py-12 text-center text-sm text-muted-foreground">
              <MessageSquareText className="mx-auto h-8 w-8 text-muted-foreground/60" />
              <p className="mt-2 font-medium">
                {ulasanSubTab === "saya"
                  ? "Kamu belum menulis ulasan berstruk."
                  : "Belum ada ulasan."}
              </p>
              <Link
                to="/"
                className="mt-3 inline-flex h-9 items-center rounded-full bg-primary px-4 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90 active:scale-95"
              >
                Cari Warung di Peta
              </Link>
            </div>
          ) : (
            <ul className="space-y-3">
              {displayedReviews.map((r) => {
                const w = getWarung(s, r.warungId);
                return (
                  <li
                    key={r.id}
                    className="rounded-3xl border border-white/10 bg-card p-4 shadow-xs"
                  >
                    {/* Header ulasan & link warung */}
                    {w && (
                      <Link
                        to="/warung/$id"
                        params={{ id: w.id }}
                        className="mb-3 flex items-center justify-between rounded-xl bg-white/5 p-2.5 transition hover:bg-white/10"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <Store className="h-4 w-4 shrink-0 text-amber-400" />
                          <span className="truncate text-xs font-bold text-foreground">
                            {w.name}
                          </span>
                        </div>
                        <span className="shrink-0 text-[11px] font-semibold text-primary">
                          Lihat Warung →
                        </span>
                      </Link>
                    )}

                    <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3">
                      <span className="grid h-9 w-9 place-items-center rounded-full bg-secondary font-display font-semibold">
                        {r.author.charAt(0)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{r.author}</p>
                        <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                          <Stars value={r.rating} size={12} />
                          <span>{new Date(r.createdAt).toLocaleDateString("id-ID")}</span>
                        </div>
                      </div>
                    </div>

                    {r.receipt ? (
                      <button
                        type="button"
                        onClick={() => setSelectedReceipt(r.receipt)}
                        className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-sky-400/10 px-2.5 py-1 text-[11px] font-medium text-sky-300 transition-colors hover:bg-sky-400/20 active:scale-95"
                      >
                        <Receipt className="h-3 w-3" />
                        <span>Pembelian terverifikasi struk · Lihat</span>
                      </button>
                    ) : (
                      <p className="mt-2.5 inline-flex items-center gap-1 rounded-full bg-success/15 px-2.5 py-1 text-[11px] font-medium text-success">
                        <Receipt className="h-3 w-3" />
                        Pembelian terverifikasi
                      </p>
                    )}

                    {r.text && (
                      <p className="mt-2 text-xs leading-relaxed text-foreground/90">{r.text}</p>
                    )}

                    {r.photos.length > 0 && (
                      <div className="no-scrollbar mt-2.5 flex gap-2 overflow-x-auto">
                        {r.photos.map((p, i) => (
                          <img
                            key={i}
                            src={p}
                            alt=""
                            className="h-20 w-20 shrink-0 rounded-xl object-cover border border-white/5"
                          />
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {/* Konten Tab Favorit */}
      {tab === "favorit" && (
        <section className="mt-4">
          {bookmarkedWarungs.length === 0 ? (
            <div className="rounded-3xl border border-white/10 bg-card/60 p-6 text-center shadow-xs">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-rose-500/10 text-rose-400">
                <Heart className="h-6 w-6" />
              </div>
              <p className="mt-3 font-display text-sm font-semibold text-foreground">
                Belum ada warung favorit
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Ketuk ikon hati ❤️ pada kartu atau profil warung untuk menyimpannya di sini.
              </p>
              <Link
                to="/"
                className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-2 text-xs font-semibold text-foreground transition hover:bg-white/15 active:scale-95"
              >
                <Utensils className="h-3.5 w-3.5" />
                <span>Jelajahi Warung Sekitar</span>
              </Link>
            </div>
          ) : (
            <div className="space-y-2.5">
              {bookmarkedWarungs.map((w) => {
                const rating = ratingOf(s, w.id);
                const dist = distanceKm(geo.loc, w);
                const minP = getMinPrice(w);

                return (
                  <div
                    key={w.id}
                    className="group relative flex items-center gap-3 rounded-2xl border border-white/10 bg-card p-3 shadow-xs transition hover:border-white/20"
                  >
                    <Link to="/warung/$id" params={{ id: w.id }} className="shrink-0">
                      <img
                        src={w.cover || PLACEHOLDER_COVER}
                        alt={w.name}
                        className="h-16 w-16 rounded-xl object-cover bg-muted border border-white/5"
                      />
                    </Link>

                    <Link
                      to="/warung/$id"
                      params={{ id: w.id }}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="truncate font-display text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                        {w.name}
                      </p>
                      <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="font-bold text-foreground">
                          {rating.avg ? rating.avg.toFixed(1) : "–"}
                        </span>
                        <Stars value={rating.avg} size={10} />
                        <span className="truncate">· {formatDistance(dist)}</span>
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-[11px]">
                        <span className="truncate text-muted-foreground">{w.category}</span>
                        {minP !== null && (
                          <span className="font-semibold text-amber-300">
                            Mulai Rp {minP.toLocaleString("id-ID")}
                          </span>
                        )}
                      </div>
                    </Link>

                    <button
                      type="button"
                      aria-label={`Hapus ${w.name} dari favorit`}
                      onClick={() => {
                        actions.toggleBookmark(w.id);
                        toast.success(`"${w.name}" dihapus dari favorit`);
                      }}
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:bg-rose-500/10 hover:text-rose-400 active:scale-90"
                      title="Hapus dari favorit"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Modal Bukti Struk */}
      {selectedReceipt && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setSelectedReceipt(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-h-[90vh] max-w-sm w-full overflow-hidden rounded-3xl border border-white/10 bg-card p-4 shadow-2xl"
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Receipt className="h-4 w-4 text-sky-400" />
                <span className="font-display text-sm font-bold">Bukti Struk Pembelian</span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedReceipt(null)}
                className="grid h-8 w-8 place-items-center rounded-full bg-white/5 hover:bg-white/10 active:scale-95"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-3 overflow-auto max-h-[65vh] rounded-2xl bg-black/40 p-2">
              <img
                src={selectedReceipt}
                alt="Struk Pembelian"
                className="w-full rounded-xl object-contain"
              />
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </main>
  );
}
