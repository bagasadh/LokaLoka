import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Camera,
  Clock,
  CreditCard,
  Heart,
  HelpCircle,
  Info,
  MapPin,
  MessageCircle,
  MessageSquare,
  Moon,
  Navigation,
  Pencil,
  Phone,
  Plus,
  Receipt,
  Send,
  Share2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  Utensils,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { SourceBadge, Stars } from "@/components/WarungBits";
import RouteModal from "@/components/RouteModal";
import { useGeo } from "@/lib/geo";
import { fetchPlaceById, getKnownPlace } from "@/lib/places";
import {
  analyzeMenuItemPrice,
  calculateWarungPriceRadar,
  type PriceTier,
  type WarungPriceRadar,
} from "@/lib/price-radar";
import {
  actions,
  getWarung,
  isBookmarked,
  ratingOf,
  readFileAsDataUrl,
  useStore,
} from "@/lib/store";
import {
  PLACEHOLDER_COVER,
  USER_LOCATION,
  WARUNGS,
  canSubmitReview,
  distanceKm,
  formatAgo,
  formatDistance,
  formatRupiah,
  getScheduleInsight,
  hoursLabel,
  type MenuItem,
  type Warung,
} from "@/lib/warung-data";

export const Route = createFileRoute("/warung/$id")({
  loader: async ({ params }) => {
    const sample = WARUNGS.find((x) => x.id === params.id);
    // Tempat hasil deteksi peta: pakai cache, kalau tidak ada (link dibuka langsung) ambil dari OpenStreetMap
    const place = sample
      ? null
      : (getKnownPlace(params.id) ?? (await fetchPlaceById(params.id).catch(() => null)));
    const w = sample ?? place;
    if (!w) throw notFound();
    return { name: w.name, address: w.address, place };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData ? `${loaderData.name} — Lokaloka` : "Warung — Lokaloka" },
      {
        name: "description",
        content: loaderData
          ? `Menu, harga terbaru, dan ulasan ${loaderData.name}, ${loaderData.address}.`
          : "Profil warung di Lokaloka.",
      },
      {
        property: "og:title",
        content: loaderData ? `${loaderData.name} — Lokaloka` : "Warung — Lokaloka",
      },
      {
        property: "og:description",
        content: "Menu, harga terbaru, dan ulasan pembeli terverifikasi.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WarungPage,
});

function WarungPage() {
  const { id } = Route.useParams();
  const { place } = Route.useLoaderData();
  const s = useStore();
  const geo = useGeo();
  const router = useRouter();
  const w = getWarung(s, id) ?? place!;
  const rating = ratingOf(s, id);
  const reviews = s.reviews.filter((r) => r.warungId === id);
  const comments = s.comments.filter((c) => c.warungId === id);
  const isFav = isBookmarked(s, w.id);
  const [tab, setTab] = useState<"menu" | "ulasan" | "diskusi">("menu");
  const [writing, setWriting] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<string | null>(null);
  const [routeOpen, setRouteOpen] = useState(false);
  const [radarInfoOpen, setRadarInfoOpen] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);

  const receiptCount = reviews.filter((r) => Boolean(r.receipt)).length;
  const timing = getScheduleInsight(w);
  const getokReports = s.priceReports.filter(
    (r) => r.warungId === w.id && r.type === "getok_alert",
  );
  const priceRadar = useMemo(() => {
    return calculateWarungPriceRadar(w, {
      neighborWarungs: WARUNGS,
      receiptCount,
    });
  }, [w, receiptCount]);

  // Pastikan scroll window selalu aktif dan reset ke atas saat profil dibuka
  useEffect(() => {
    document.body.style.overflow = "";
    window.scrollTo(0, 0);
  }, [id]);

  const share = async () => {
    const url = window.location.href;
    if (navigator.share) await navigator.share({ title: w.name, url }).catch(() => {});
    else {
      await navigator.clipboard.writeText(url);
      toast.success("Link disalin");
    }
  };

  return (
    <main className="mx-auto min-h-dvh w-full max-w-2xl overflow-x-hidden bg-background pb-32">
      <div className="relative">
        <img
          src={w.cover || PLACEHOLDER_COVER}
          alt={w.name}
          className="aspect-[16/10] w-full object-cover sm:aspect-[16/8]"
        />
        <div className="absolute inset-x-0 top-0 flex items-center justify-between px-3 pt-safe">
          <button
            aria-label="Kembali"
            onClick={() =>
              window.history.length > 1 ? router.history.back() : router.navigate({ to: "/" })
            }
            className="grid h-11 w-11 place-items-center rounded-full bg-background/80 backdrop-blur"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label={isFav ? "Hapus dari favorit" : "Simpan ke favorit"}
              onClick={() => {
                const added = actions.toggleBookmark(w.id);
                toast.success(
                  added ? `"${w.name}" disimpan ke favorit ❤️` : "Dihapus dari favorit",
                );
              }}
              className="grid h-11 w-11 place-items-center rounded-full bg-background/80 backdrop-blur transition-transform active:scale-95"
            >
              <Heart
                className={`h-5 w-5 transition-colors ${
                  isFav ? "fill-rose-500 text-rose-500" : "text-foreground"
                }`}
              />
            </button>
            <button
              aria-label="Bagikan"
              onClick={share}
              className="grid h-11 w-11 place-items-center rounded-full bg-background/80 backdrop-blur transition-transform active:scale-95"
            >
              <Share2 className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      <section className="px-4 pt-4">
        <h1 className="text-2xl font-bold leading-tight">{w.name}</h1>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
          <span className="text-foreground">{rating.avg ? rating.avg.toFixed(1) : "Baru"}</span>
          <Stars value={rating.avg} />
          <span>({rating.count} ulasan)</span>
          <span>· {w.category}</span>
        </div>
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
          <li className="flex gap-2">
            <MapPin className="h-4 w-4 shrink-0" />
            <span className="min-w-0">
              {w.address} · {formatDistance(distanceKm(geo.loc, w))}
            </span>
          </li>
          <li className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 shrink-0" />
              <span>{hoursLabel(w)}</span>
            </div>
            {timing.isClosingSoon && (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-300">
                <span>⏳ Tutup {timing.minutesLeft} mnt lagi!</span>
              </span>
            )}
            {timing.isLateNight && (
              <span className="inline-flex items-center gap-1 rounded-full border border-indigo-500/30 bg-indigo-500/15 px-2 py-0.5 text-[11px] font-semibold text-indigo-300">
                <Moon className="h-3 w-3" />
                <span>Kuliner Malam</span>
              </span>
            )}
          </li>
          <li className="flex flex-wrap items-center gap-2">
            <CreditCard className="h-4 w-4 shrink-0 text-cyan-400" />
            <span className="text-foreground">
              {w.hasQris ? "Menerima QRIS & Tunai" : "Hanya Menerima Uang Tunai"}
            </span>
            {w.hasQris ? (
              <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-1.5 py-0.2 text-[10px] font-bold text-cyan-300">
                QRIS AKTIF
              </span>
            ) : (
              <span className="rounded-full border border-white/10 bg-white/5 px-1.5 py-0.2 text-[10px] font-medium text-muted-foreground">
                CASH ONLY
              </span>
            )}
          </li>
        </ul>
        {w.registered ? (
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-success/15 px-3 py-1 text-xs font-medium text-success">
            <BadgeCheck className="h-3.5 w-3.5" />
            Pemilik terdaftar di Lokaloka
          </p>
        ) : (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-muted px-3 py-2 text-xs text-muted-foreground">
            <span>
              {w.source === "osm"
                ? "Tempat ini terdeteksi dari peta OpenStreetMap."
                : "Pemilik belum terdaftar."}
            </span>
            <button
              type="button"
              onClick={() => {
                if (!s.user) {
                  router.navigate({ to: "/masuk", search: { next: `/warung/${w.id}` } });
                } else {
                  actions.claimWarung(w.id);
                  toast.success(`${w.name} berhasil didaftarkan sebagai warungmu!`);
                  router.navigate({ to: "/pemilik" });
                }
              }}
              className="font-semibold text-foreground underline hover:text-primary"
            >
              Ini warung saya
            </button>
          </div>
        )}

        <div className="mt-4 grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => setRouteOpen(true)}
            className="flex h-12 min-w-0 items-center justify-center gap-1.5 rounded-full bg-primary px-2 text-sm font-semibold text-primary-foreground transition hover:opacity-95"
          >
            <Navigation className="h-4 w-4 shrink-0" />
            <span className="truncate">Rute</span>
          </button>
          <a
            href={w.phone ? `tel:${w.phone}` : undefined}
            aria-disabled={!w.phone}
            className={`flex h-12 min-w-0 items-center justify-center gap-1.5 rounded-full bg-card px-2 text-sm font-semibold ${w.phone ? "" : "pointer-events-none opacity-40"}`}
          >
            <Phone className="h-4 w-4 shrink-0" />
            <span className="truncate">Telepon</span>
          </a>
          <button
            onClick={share}
            className="flex h-12 min-w-0 items-center justify-center gap-1.5 rounded-full bg-card px-2 text-sm font-semibold"
          >
            <Share2 className="h-4 w-4 shrink-0" />
            <span className="truncate">Bagikan</span>
          </button>
        </div>

        {/* Banner Waspada Laporan Getok Harga dari Warga */}
        {getokReports.length > 0 && (
          <div className="mt-4 rounded-2xl border border-rose-500/40 bg-rose-500/10 p-3.5 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-bold text-rose-400">
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
                <span>Peringatan: Ada {getokReports.length} Laporan Getok Harga</span>
              </div>
              <span className="rounded-full border border-rose-500/30 bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-300">
                Waspada
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Warga melaporkan pernah dikenai harga tidak wajar saat membayar. Selalu konfirmasi
              harga menu terlebih dahulu sebelum memesan!
            </p>
            <div className="mt-3 space-y-2 border-t border-rose-500/20 pt-2.5">
              {getokReports.map((r) => (
                <div
                  key={r.id}
                  className="rounded-xl border border-white/5 bg-background/60 p-2.5 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-foreground">{r.itemName}</span>
                    <span className="font-bold text-rose-400">
                      Dipatok {formatRupiah(r.newPrice ?? 0)}
                    </span>
                  </div>
                  {r.note && <p className="mt-1 italic text-muted-foreground">"{r.note}"</p>}
                  <p className="mt-1 text-[10px] text-muted-foreground/70">
                    Laporan warga: {r.reporter} ·{" "}
                    {formatAgo(Math.round((Date.now() - r.createdAt) / 60000))}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Banner Waspada Laporan Getok Harga dari Warga */}
        {getokReports.length > 0 && (
          <div className="mt-4 rounded-2xl border border-rose-500/40 bg-rose-500/10 p-3.5 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-bold text-rose-400">
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
                <span>Peringatan: Ada {getokReports.length} Laporan Getok Harga</span>
              </div>
              <span className="rounded-full border border-rose-500/30 bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-300">
                Waspada
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Warga melaporkan pernah dikenai harga tidak wajar saat membayar. Selalu konfirmasi harga menu terlebih dahulu sebelum memesan!
            </p>
            <div className="mt-3 space-y-2 border-t border-rose-500/20 pt-2.5">
              {getokReports.map((r) => (
                <div key={r.id} className="rounded-xl border border-white/5 bg-background/60 p-2.5 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-foreground">{r.itemName}</span>
                    <span className="font-bold text-rose-400">Dipatok {formatRupiah(r.newPrice ?? 0)}</span>
                  </div>
                  {r.note && <p className="mt-1 italic text-muted-foreground">"{r.note}"</p>}
                  <p className="mt-1 text-[10px] text-muted-foreground/70">
                    Laporan warga: {r.reporter} · {formatAgo(Math.round((Date.now() - r.createdAt) / 60000))}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Card Radar Anti-Getok Harga */}
        <PriceRadarCard radar={priceRadar} onOpenInfo={() => setRadarInfoOpen(true)} />
      </section>

      <div className="sticky top-0 z-10 mt-5 grid grid-cols-3 border-b bg-background">
        {[
          { key: "menu", label: `Menu (${w.menu.length})` },
          { key: "ulasan", label: `Ulasan (${reviews.length})` },
          { key: "diskusi", label: `Tanya (${comments.length})` },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as "menu" | "ulasan" | "diskusi")}
            className={`h-12 text-sm font-semibold capitalize transition-colors ${
              tab === t.key
                ? "border-b-2 border-primary text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "menu" && (
        <div className="px-4">
          {/* Bar Lapor Perubahan Harga & Tambah Menu */}
          <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-card p-3 shadow-xs">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-amber-400 shrink-0" />
                <p className="font-display text-xs font-bold text-foreground truncate">
                  Transparansi Harga Kaki Lima
                </p>
              </div>
              <p className="text-[11px] text-muted-foreground truncate">
                Harga beda dengan di tempat? Bantu warga dengan lapor update
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setEditingItem(null);
                setReportModalOpen(true);
              }}
              className="inline-flex h-8 shrink-0 items-center gap-1 rounded-xl bg-primary px-3 text-xs font-semibold text-primary-foreground shadow-xs transition hover:bg-primary/90 active:scale-95"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Update / Tambah</span>
            </button>
          </div>

          {w.menu.length === 0 ? (
            <div className="py-12 text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
                <Utensils className="h-6 w-6" />
              </div>
              <p className="mt-3 text-sm font-semibold text-foreground">
                Menu dan harga untuk tempat ini belum tersedia.
              </p>
              <p className="mt-1 text-xs text-muted-foreground/80 max-w-xs mx-auto">
                Bantu warga sekitar dengan menambahkan menu atau harga yang kamu temukan di warung
                ini!
              </p>
              <button
                type="button"
                onClick={() => {
                  setEditingItem(null);
                  setReportModalOpen(true);
                }}
                className="mt-4 inline-flex h-10 items-center gap-1.5 rounded-full bg-primary px-5 text-xs font-semibold text-primary-foreground shadow-xs transition hover:bg-primary/90 active:scale-95"
              >
                <Plus className="h-4 w-4" />
                <span>Tambah Menu Warung Ini</span>
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {w.menu.map((m) => {
                const analysis = analyzeMenuItemPrice(m);
                return (
                  <li
                    key={m.id}
                    className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 py-4"
                  >
                    {m.photo ? (
                      <img
                        src={m.photo}
                        alt={m.name}
                        loading="lazy"
                        className="h-20 w-20 rounded-2xl object-cover bg-muted border border-white/5"
                      />
                    ) : (
                      <div className="grid h-20 w-20 shrink-0 place-items-center rounded-2xl border border-white/5 bg-muted text-muted-foreground">
                        <Utensils className="h-6 w-6 opacity-60" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{m.name}</p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2">
                        <span className="font-display text-lg font-bold">
                          {formatRupiah(m.price)}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide ${analysis.badgeBg} ${analysis.badgeText}`}
                        >
                          {analysis.tier === "cheap" && "📉 "}
                          {analysis.tier === "fair" && "✓ "}
                          {analysis.tier === "high" && "📈 "}
                          {analysis.tier === "overpriced" && "⚠️ "}
                          {analysis.label}
                        </span>
                      </div>
                      <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                        <SourceBadge source={m.source} />
                        <span className="text-[11px] text-muted-foreground">
                          diperbarui {formatAgo(m.updatedMinAgo)}
                        </span>
                        {analysis.benchmark && (
                          <span className="text-[11px] text-muted-foreground/80">
                            · Pasaran: {formatRupiah(analysis.referenceAvg)}
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setEditingItem(m);
                        setReportModalOpen(true);
                      }}
                      title="Laporkan perubahan harga untuk menu ini"
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/5 text-muted-foreground transition hover:border-amber-500/30 hover:bg-amber-500/10 hover:text-amber-300 active:scale-90"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {tab === "ulasan" && (
        <div className="px-4">
          <ul className="divide-y divide-border">
            {reviews.length === 0 && (
              <li className="py-10 text-center text-sm text-muted-foreground">
                Belum ada ulasan. Jadi yang pertama!
              </li>
            )}
            {reviews.map((r) => (
              <li key={r.id} className="py-4">
                <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-secondary font-semibold">
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
                    className="mt-2 inline-flex items-center gap-1 rounded-full bg-sky-400/10 px-2 py-0.5 text-[11px] font-medium text-sky-300 transition-colors hover:bg-sky-400/20 active:scale-95"
                  >
                    <Receipt className="h-3 w-3" />
                    <span>Pembelian terverifikasi struk · Lihat</span>
                  </button>
                ) : (
                  <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-medium text-success">
                    <Receipt className="h-3 w-3" />
                    Pembelian terverifikasi
                  </p>
                )}
                {r.text && <p className="mt-2 text-sm">{r.text}</p>}
                {r.photos.length > 0 && (
                  <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto">
                    {r.photos.map((p, i) => (
                      <img
                        key={i}
                        src={p}
                        alt=""
                        className="h-24 w-24 shrink-0 rounded-xl object-cover"
                      />
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === "diskusi" && <DiscussionSection warungId={w.id} warungName={w.name} />}

      <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 px-4 pt-3 pb-safe backdrop-blur">
        <div className="mx-auto max-w-2xl">
          {tab === "diskusi" ? (
            <button
              onClick={() => {
                const el = document.getElementById("discussion-input");
                el?.scrollIntoView({ behavior: "smooth", block: "center" });
                el?.focus();
              }}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary text-sm font-semibold text-primary-foreground shadow-md transition-all hover:bg-primary/90 active:scale-95"
            >
              <MessageSquare className="h-4 w-4" />
              <span>Tulis Pertanyaan Baru</span>
            </button>
          ) : (
            <button
              onClick={() =>
                s.user
                  ? setWriting(true)
                  : router.navigate({ to: "/masuk", search: { next: `/warung/${id}` } })
              }
              className="h-12 w-full rounded-full bg-primary text-sm font-semibold text-primary-foreground shadow-md transition-all hover:bg-primary/90 active:scale-95"
            >
              {s.user ? "Sudah beli? Tulis ulasan" : "Masuk untuk menulis ulasan"}
            </button>
          )}
        </div>
      </div>

      {writing && s.user && (
        <ReviewSheet
          warungId={id}
          author={s.user.name}
          onClose={() => {
            setWriting(false);
            setTab("ulasan");
          }}
        />
      )}

      {selectedReceipt && (
        <ReceiptModal src={selectedReceipt} onClose={() => setSelectedReceipt(null)} />
      )}

      {radarInfoOpen && <RadarInfoModal onClose={() => setRadarInfoOpen(false)} />}

      {routeOpen && <RouteModal from={geo.loc} warung={w} onClose={() => setRouteOpen(false)} />}

      {reportModalOpen && (
        <ReportPriceModal
          warung={w}
          initialItem={editingItem}
          onClose={() => {
            setReportModalOpen(false);
            setEditingItem(null);
          }}
        />
      )}
    </main>
  );
}

function PriceRadarCard({
  radar,
  onOpenInfo,
}: {
  radar: WarungPriceRadar;
  onOpenInfo: () => void;
}) {
  const isCheap = radar.tier === "cheap";
  const isFair = radar.tier === "fair";
  const isHigh = radar.tier === "high";
  const isOverpriced = radar.tier === "overpriced";

  const cardStyle = isOverpriced
    ? "border-rose-500/30 bg-gradient-to-br from-rose-950/40 via-card to-card"
    : isHigh
      ? "border-amber-500/30 bg-gradient-to-br from-amber-950/30 via-card to-card"
      : isCheap
        ? "border-emerald-500/30 bg-gradient-to-br from-emerald-950/30 via-card to-card"
        : "border-primary/25 bg-gradient-to-br from-primary/10 via-card to-card";

  const badgeStyle = isOverpriced
    ? "bg-rose-500/15 text-rose-300 border-rose-500/30"
    : isHigh
      ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
      : isCheap
        ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
        : "bg-primary/15 text-primary border-primary/30";

  return (
    <div className={`mt-4 rounded-3xl border p-4 shadow-sm transition-all ${cardStyle}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${badgeStyle}`}
            >
              {isOverpriced ? (
                <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-rose-400" />
              ) : isHigh ? (
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-400" />
              ) : isCheap ? (
                <TrendingDown className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
              ) : (
                <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-primary" />
              )}
              {radar.title}
            </span>
            {radar.hasVerifiedReceipts && (
              <span className="inline-flex items-center gap-1 rounded-full bg-sky-400/10 px-2 py-0.5 text-[11px] font-medium text-sky-300">
                <Receipt className="h-3 w-3" />
                Struk Terverifikasi
              </span>
            )}
          </div>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground sm:text-sm">
            {radar.description}
          </p>
        </div>
        <button
          type="button"
          aria-label="Pelajari Radar Anti-Getok"
          onClick={onOpenInfo}
          className="flex shrink-0 items-center gap-1 rounded-full bg-secondary/80 px-2.5 py-1 text-xs font-medium text-muted-foreground transition hover:text-foreground active:scale-95"
        >
          <Info className="h-3.5 w-3.5" />
          <span>Info</span>
        </button>
      </div>

      {radar.averagePrice > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/60 pt-3 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">
            Rata-rata: {formatRupiah(radar.averagePrice)}
          </span>
          <span>·</span>
          <span>{radar.analyzedCount} menu terdaftar</span>
          {radar.hasVerifiedReceipts && (
            <>
              <span>·</span>
              <span className="text-sky-300">{radar.receiptCount} bukti struk</span>
            </>
          )}
        </div>
      )}

      {isOverpriced && (
        <div className="mt-3 rounded-2xl bg-rose-500/10 p-2.5 text-xs text-rose-200">
          <p className="font-semibold">⚠️ Tips Hindari Getok Harga:</p>
          <p className="mt-0.5 text-[11px] text-rose-200/90">
            Tanyakan harga pasti sebelum memesan atau minta nota rincian untuk mencegah markup tak
            wajar.
          </p>
        </div>
      )}
    </div>
  );
}

function RadarInfoModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Penjelasan Radar Anti-Getok Harga"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-0 sm:p-4 sm:items-center backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-3xl sm:rounded-3xl border border-white/10 bg-card p-5 shadow-float"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-primary/15 text-primary">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base font-bold">Radar Anti-Getok Harga</h2>
              <p className="text-[11px] text-muted-foreground">
                Perlindungan pembeli & keterbukaan harga
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Tutup penjelasan radar"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full bg-muted text-muted-foreground transition hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 space-y-4 text-xs leading-relaxed text-muted-foreground">
          <p>
            Fitur <strong className="text-foreground">Radar Anti-Getok</strong> dirancang khusus
            oleh Lokaloka untuk melindungi pembeli, mahasiswa, perantau, dan wisatawan dari praktik
            kenaikan harga sepihak atau ketiadaan daftar menu resmi.
          </p>

          <div className="rounded-2xl border border-white/5 bg-muted/50 p-3.5 space-y-2">
            <p className="font-semibold text-foreground">3 Sumber Penilaian:</p>
            <ul className="space-y-1.5 list-disc pl-4">
              <li>
                <strong className="text-foreground">Indeks Harga Standar:</strong> Acuan harga
                rata-rata hidangan kuliner rakyat di area sekitar.
              </li>
              <li>
                <strong className="text-foreground">Komparasi Tetangga:</strong> Perbandingan
                real-time dengan menu sejenis di warung radius terdekat.
              </li>
              <li>
                <strong className="text-foreground">Verifikasi Struk Nyata:</strong> Setiap ulasan
                yang menyertakan foto struk pembeli langsung memvalidasi keaslian harga.
              </li>
            </ul>
          </div>

          <div>
            <p className="mb-2 font-semibold text-foreground">Level Kewajaran Harga:</p>
            <div className="space-y-2">
              <div className="flex items-start gap-2 rounded-xl bg-emerald-500/10 p-2.5 text-emerald-300">
                <span className="text-base leading-none">🟢</span>
                <div>
                  <p className="font-semibold text-xs text-foreground">
                    Sangat Ramah Kantong (&le; -15%)
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Harga lebih hemat dari pasaran umum, sangat ramah budget pelajar/harian.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2 rounded-xl bg-primary/10 p-2.5 text-primary">
                <span className="text-base leading-none">🟢</span>
                <div>
                  <p className="font-semibold text-xs text-foreground">
                    Harga Wajar Pasaran (-15% s/d +15%)
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Sesuai dengan standar harga pedagang makanan di kawasan setempat.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2 rounded-xl bg-amber-500/10 p-2.5 text-amber-300">
                <span className="text-base leading-none">🟡</span>
                <div>
                  <p className="font-semibold text-xs text-foreground">
                    Sedikit di Atas Rata-rata (+16% s/d +39%)
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Sedikit lebih mahal (umumnya karena porsi lebih besar atau fasilitas tempat
                    dine-in).
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2 rounded-xl bg-rose-500/10 p-2.5 text-rose-300">
                <span className="text-base leading-none">🔴</span>
                <div>
                  <p className="font-semibold text-xs text-foreground">
                    Waspada Potensi Getok (&ge; +40%)
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Harga terpantau jauh melampaui harga rata-rata sekitar. Pastikan konfirmasi
                    harga sebelum pesan.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-sky-400/20 bg-sky-400/10 p-3 text-sky-200">
            <p className="font-semibold">💡 Ikut Berkontribusi:</p>
            <p className="mt-0.5 text-[11px] text-sky-200/90">
              Kamu bisa membantu sesama dengan mengunggah foto struk saat memberikan ulasan di
              Lokaloka!
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-5 h-11 w-full rounded-full bg-primary text-xs font-semibold text-primary-foreground"
        >
          Mengerti, Lanjut Kulineran
        </button>
      </div>
    </div>
  );
}

function ReceiptModal({ src, onClose }: { src: string; onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Foto struk pembelian"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative max-h-[85vh] w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-card p-3 shadow-float"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex items-center justify-between px-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-sky-300">
            <Receipt className="h-4 w-4" />
            <span>Bukti Struk Pembelian</span>
          </div>
          <button
            type="button"
            aria-label="Tutup foto struk"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <img
          src={src}
          alt="Bukti struk pembelian"
          className="max-h-[70vh] w-full rounded-2xl object-contain bg-black/40"
        />
      </div>
    </div>
  );
}

function ReviewSheet({
  warungId,
  author,
  onClose,
}: {
  warungId: string;
  author: string;
  onClose: () => void;
}) {
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [receipt, setReceipt] = useState<string | null>(null);
  const ok = canSubmitReview({ rating, receipt });

  const submit = () => {
    if (!ok || !receipt) return;
    actions.addReview({
      id: crypto.randomUUID(),
      warungId,
      author,
      rating,
      text: text.trim(),
      photos,
      receipt,
      createdAt: Date.now(),
    });
    toast.success("Ulasan terkirim. Terima kasih!");
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-background/70 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-3xl border bg-card sm:rounded-3xl"
      >
        <div className="grid shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-4 pt-4">
          <h2 className="truncate text-lg font-bold">Tulis ulasan</h2>
          <button
            aria-label="Tutup"
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-full bg-muted"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4">
          <div>
            <p className="mb-2 text-sm text-muted-foreground">Rating</p>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <button
                  key={i}
                  aria-label={`${i} bintang`}
                  onClick={() => setRating(i)}
                  className="grid h-11 w-11 place-items-center"
                >
                  <Stars value={i <= rating ? 1 : 0} size={0} />
                  <svg
                    viewBox="0 0 24 24"
                    className={`h-9 w-9 ${i <= rating ? "fill-star text-star" : "fill-none text-muted-foreground"}`}
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z" />
                  </svg>
                </button>
              ))}
            </div>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={500}
            rows={4}
            placeholder="Ceritakan pengalamanmu: rasa, harga, pelayanan…"
            className="w-full rounded-2xl border bg-background p-3 text-sm outline-none focus:border-ring"
          />
          <div>
            <p className="mb-2 text-sm text-muted-foreground">Foto makanan (opsional)</p>
            <div className="flex flex-wrap gap-2">
              {photos.map((p, i) => (
                <div key={i} className="relative">
                  <img src={p} alt="" className="h-20 w-20 rounded-xl object-cover" />
                  <button
                    aria-label="Hapus foto"
                    onClick={() => setPhotos((ps) => ps.filter((_, j) => j !== i))}
                    className="absolute -right-1 -top-1 grid h-6 w-6 place-items-center rounded-full bg-primary text-primary-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {photos.length < 4 && (
                <label className="grid h-20 w-20 cursor-pointer place-items-center rounded-xl border border-dashed text-muted-foreground">
                  <Camera className="h-6 w-6" />
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="sr-only"
                    onChange={async (e) => {
                      const files = Array.from(e.target.files ?? []).slice(0, 4 - photos.length);
                      const urls = await Promise.all(files.map((f) => readFileAsDataUrl(f)));
                      setPhotos((ps) => [...ps, ...urls]);
                    }}
                  />
                </label>
              )}
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm text-muted-foreground">
              Foto struk <span className="text-destructive">*wajib</span>
            </p>
            {receipt ? (
              <div className="relative inline-block">
                <img src={receipt} alt="Struk" className="h-32 rounded-xl object-cover" />
                <button
                  aria-label="Ganti struk"
                  onClick={() => setReceipt(null)}
                  className="absolute -right-1 -top-1 grid h-6 w-6 place-items-center rounded-full bg-primary text-primary-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <label className="flex h-20 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed text-sm text-muted-foreground">
                <Receipt className="h-5 w-5" /> Unggah foto struk sebagai bukti beli
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (f) setReceipt(await readFileAsDataUrl(f));
                  }}
                />
              </label>
            )}
          </div>
        </div>
        <div className="shrink-0 border-t px-4 pt-3 pb-safe">
          <button
            disabled={!ok}
            onClick={submit}
            className="h-12 w-full rounded-full bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-40"
          >
            {ok ? "Kirim ulasan" : !rating ? "Pilih rating dulu" : "Lampirkan struk dulu"}
          </button>
        </div>
      </div>
    </div>
  );
}

function DiscussionSection({ warungId, warungName }: { warungId: string; warungName: string }) {
  const s = useStore();
  const comments = useMemo(
    () => s.comments.filter((c) => c.warungId === warungId),
    [s.comments, warungId],
  );

  const [questionText, setQuestionText] = useState("");
  const [authorName, setAuthorName] = useState(s.user?.name ?? "");
  const [activeReplyId, setActiveReplyId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [replyAuthor, setReplyAuthor] = useState<Record<string, string>>({});

  const isOwner = Boolean(s.user?.ownerOf && s.user.ownerOf === warungId);

  const quickPrompts = [
    "Patokan lokasi persisnya sebelah mana ya kak?",
    "Parkir mobil atau motor aman dan luas ga ya?",
    "Menu yang paling enak dan recommended apa di sini?",
    "Bisa bayar pakai QRIS atau transfer ga?",
    "Kalau malam jam berapa biasanya menu sudah habis?",
    "Tingkat kepedasannya gimana ya?",
  ];

  const handleSendQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!questionText.trim()) {
      toast.error("Tulis pertanyaanmu terlebih dahulu");
      return;
    }
    const finalAuthor = s.user?.name || authorName.trim() || "Pengunjung";
    actions.addComment(warungId, questionText, finalAuthor);
    setQuestionText("");
    toast.success("Pertanyaan terkirim! Pemilik atau pengunjung lain bisa segera menjawab.");
  };

  const handleSendReply = (commentId: string) => {
    const text = replyText[commentId]?.trim();
    if (!text) {
      toast.error("Tulis jawaban atau balasanmu terlebih dahulu");
      return;
    }
    const finalAuthor =
      s.user?.name ||
      replyAuthor[commentId]?.trim() ||
      (isOwner ? "Pemilik Warung" : "Warga Sekitar");

    actions.addCommentReply(commentId, text, finalAuthor);
    setReplyText((prev) => ({ ...prev, [commentId]: "" }));
    setActiveReplyId(null);
    toast.success("Balasan berhasil dikirim!");
  };

  return (
    <div className="space-y-5 px-4 py-4">
      {/* Banner Edukatif: Perbedaan Komentar & Ulasan */}
      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-3.5 text-xs text-muted-foreground">
        <div className="flex items-center gap-2 font-semibold text-amber-300">
          <HelpCircle className="h-4 w-4" />
          <span>Ruang Tanya Jawab & Diskusi Terbuka</span>
        </div>
        <p className="mt-1 leading-relaxed">
          Bebas bertanya apa saja seputar patokan lokasi, porsi, atau rasa menu tanpa syarat
          beli/struk. Pemilik warung dan sesama pengunjung bisa saling menjawab!
        </p>
      </div>

      {/* Form Buat Pertanyaan Baru */}
      <form
        onSubmit={handleSendQuestion}
        className="rounded-3xl border border-white/10 bg-card p-4 shadow-sm"
      >
        <h3 className="text-sm font-bold text-foreground">
          Punya Pertanyaan tentang {warungName}?
        </h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Tanya patokan gang, rekomendasi menu, fasilitas, atau parkir
        </p>

        {/* Quick Prompt Chips */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {quickPrompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => setQuestionText(prompt)}
              className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-muted-foreground transition hover:border-amber-500/40 hover:bg-amber-500/10 hover:text-foreground active:scale-95 text-left"
            >
              <span>{prompt}</span>
            </button>
          ))}
        </div>

        <div className="mt-3 space-y-2">
          <textarea
            id="discussion-input"
            rows={3}
            value={questionText}
            onChange={(e) => setQuestionText(e.target.value)}
            placeholder="Tulis pertanyaanmu di sini..."
            className="w-full resize-none rounded-2xl border border-white/10 bg-background/80 p-3 text-sm outline-none transition focus:border-primary/50 focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground/60"
          />

          <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:items-center sm:justify-between">
            {!s.user ? (
              <input
                type="text"
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                placeholder="Nama kamu (misal: Rian / Mahasiswa)"
                className="h-10 rounded-xl border border-white/10 bg-background/80 px-3 text-xs outline-none focus:border-primary/50"
              />
            ) : (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-primary/20 text-[10px] font-bold text-primary">
                  {s.user.name.charAt(0)}
                </span>
                <span>
                  Bertanya sebagai <b>{s.user.name}</b> {isOwner && "👑 (Pemilik)"}
                </span>
              </div>
            )}
            <button
              type="submit"
              className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-primary px-4 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90 active:scale-95"
            >
              <Send className="h-3.5 w-3.5" />
              <span>Kirim Pertanyaan</span>
            </button>
          </div>
        </div>
      </form>

      {/* Daftar Pertanyaan & Balasan */}
      <div className="space-y-3.5">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold text-foreground">
            Semua Pertanyaan & Diskusi ({comments.length})
          </h4>
        </div>

        {comments.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 py-10 text-center text-sm text-muted-foreground">
            <MessageSquare className="mx-auto mb-2 h-7 w-7 text-muted-foreground/40" />
            <p>Belum ada pertanyaan di sini.</p>
            <p className="mt-1 text-xs text-muted-foreground/70">
              Jadilah orang pertama yang bertanya tentang warung ini!
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {comments.map((c) => {
              const minAgo = Math.max(1, Math.round((Date.now() - c.createdAt) / 60000));
              const isReplying = activeReplyId === c.id;

              return (
                <article
                  key={c.id}
                  className="rounded-2xl border border-white/10 bg-card/60 p-4 shadow-sm"
                >
                  {/* Penanya Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="grid h-8 w-8 place-items-center rounded-full bg-secondary text-xs font-semibold">
                        {c.author.charAt(0).toUpperCase()}
                      </span>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-semibold text-foreground">{c.author}</p>
                          {c.isOwner && (
                            <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.2 text-[9px] font-semibold text-amber-300">
                              👑 Pemilik
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground">{formatAgo(minAgo)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Isi Pertanyaan */}
                  <p className="mt-2.5 text-sm font-medium leading-relaxed text-foreground/90">
                    {c.text}
                  </p>

                  {/* Tombol Balas */}
                  <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-2">
                    <button
                      type="button"
                      onClick={() => setActiveReplyId(isReplying ? null : c.id)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                      <span>{isReplying ? "Tutup balasan" : "Balas / Beri Jawaban"}</span>
                      {c.replies.length > 0 && (
                        <span className="font-normal text-muted-foreground">
                          · {c.replies.length} balasan
                        </span>
                      )}
                    </button>
                  </div>

                  {/* Thread Balasan (Nested Replies) */}
                  {c.replies.length > 0 && (
                    <div className="mt-3 space-y-2.5 border-l-2 border-primary/30 pl-3 pt-1">
                      {c.replies.map((rep) => {
                        const repMinAgo = Math.max(
                          1,
                          Math.round((Date.now() - rep.createdAt) / 60000),
                        );
                        return (
                          <div key={rep.id} className="rounded-xl bg-white/[0.03] p-2.5 text-xs">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-foreground">{rep.author}</span>
                              {rep.isOwner ? (
                                <span className="inline-flex items-center gap-0.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.2 text-[9px] font-bold text-amber-300">
                                  👑 Pemilik Warung
                                </span>
                              ) : (
                                <span className="rounded-full bg-white/5 px-1.5 py-0.2 text-[9px] text-muted-foreground">
                                  Warga / Pengunjung
                                </span>
                              )}
                              <span className="text-muted-foreground/70">
                                · {formatAgo(repMinAgo)}
                              </span>
                            </div>
                            <p className="mt-1 leading-relaxed text-foreground/90">{rep.text}</p>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Form Input Balasan */}
                  {isReplying && (
                    <div className="mt-3 space-y-2 rounded-xl border border-white/10 bg-background/50 p-3">
                      <p className="text-xs font-medium text-muted-foreground">
                        Balas pertanyaan dari <b>{c.author}</b>:
                      </p>
                      <input
                        type="text"
                        value={replyText[c.id] ?? ""}
                        onChange={(e) =>
                          setReplyText((prev) => ({ ...prev, [c.id]: e.target.value }))
                        }
                        placeholder="Ketik jawaban atau infomu di sini..."
                        className="w-full rounded-xl border border-white/10 bg-background p-2 text-xs outline-none focus:border-primary/50"
                      />
                      <div className="flex items-center justify-between gap-2">
                        {!s.user && (
                          <input
                            type="text"
                            value={replyAuthor[c.id] ?? ""}
                            onChange={(e) =>
                              setReplyAuthor((prev) => ({ ...prev, [c.id]: e.target.value }))
                            }
                            placeholder="Nama kamu (opsional)"
                            className="h-8 rounded-lg border border-white/10 bg-background px-2.5 text-[11px] outline-none"
                          />
                        )}
                        <button
                          type="button"
                          onClick={() => handleSendReply(c.id)}
                          className="ml-auto inline-flex h-8 items-center gap-1 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                        >
                          <Send className="h-3 w-3" />
                          <span>Kirim Balasan</span>
                        </button>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function ReportPriceModal({
  warung,
  initialItem,
  onClose,
}: {
  warung: Warung;
  initialItem: MenuItem | null;
  onClose: () => void;
}) {
  const s = useStore();
  const [tab, setTab] = useState<"update_price" | "add_menu" | "getok_alert">(
    initialItem ? "update_price" : warung.menu.length > 0 ? "update_price" : "add_menu",
  );

  // Ubah harga
  const [selectedItemId, setSelectedItemId] = useState<string>(
    initialItem?.id || warung.menu[0]?.id || "",
  );
  const selectedItem = warung.menu.find((m) => m.id === selectedItemId);
  const [updatedPrice, setUpdatedPrice] = useState<string>(
    initialItem ? String(initialItem.price) : warung.menu[0] ? String(warung.menu[0].price) : "",
  );

  // Tambah menu
  const [newMenuName, setNewMenuName] = useState("");
  const [newMenuPrice, setNewMenuPrice] = useState("");
  const [newMenuCategory, setNewMenuCategory] = useState<"makanan" | "minuman">("makanan");

  // Getok alert
  const [getokItemName, setGetokItemName] = useState(initialItem?.name || "");
  const [getokPricePaid, setGetokPricePaid] = useState("");

  // Shared
  const [reporterName, setReporterName] = useState(s.user?.name || "");
  const [reportNote, setReportNote] = useState("");
  const [acceptsQris, setAcceptsQris] = useState<boolean>(Boolean(warung.hasQris));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    actions.setWarungQris(warung.id, acceptsQris);
    if (tab === "update_price") {
      const p = parseInt(updatedPrice.replace(/\D/g, ""), 10);
      if (!selectedItem || isNaN(p) || p <= 0) {
        toast.error("Masukkan harga baru yang valid");
        return;
      }
      actions.updateMenuItemPrice(warung.id, selectedItem.id, p, reporterName, reportNote);
      toast.success(`Harga ${selectedItem.name} berhasil diperbarui menjadi ${formatRupiah(p)}`);
      onClose();
    } else if (tab === "add_menu") {
      const p = parseInt(newMenuPrice.replace(/\D/g, ""), 10);
      if (!newMenuName.trim() || isNaN(p) || p <= 0) {
        toast.error("Nama menu dan harga wajib diisi");
        return;
      }
      actions.addMenuItem(
        warung.id,
        {
          name: newMenuName.trim(),
          price: p,
          category: newMenuCategory,
        },
        reporterName,
        reportNote,
      );
      toast.success(`Menu "${newMenuName.trim()}" berhasil ditambahkan ke warung!`);
      onClose();
    } else {
      const p = parseInt(getokPricePaid.replace(/\D/g, ""), 10);
      if (!getokItemName.trim() || isNaN(p) || p <= 0) {
        toast.error("Lengkapi nama makanan dan harga yang ditagih");
        return;
      }
      actions.reportGetokAlert(warung.id, {
        itemName: getokItemName.trim(),
        pricePaid: p,
        note: reportNote.trim(),
        reporter: reporterName,
      });
      toast.success(
        "Laporan indikasi getok harga diterima. Terima kasih sudah membantu melindungi sesama warga!",
      );
      onClose();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative max-h-[92vh] max-w-md w-full overflow-y-auto rounded-3xl border border-white/10 bg-card p-5 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-400" />
            <span className="font-display text-base font-bold text-foreground">
              Lapor Perubahan Menu & Harga
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full bg-white/5 hover:bg-white/10 active:scale-95"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tab Jenis Laporan */}
        <div className="mt-4 grid grid-cols-3 gap-1 rounded-2xl border border-white/10 bg-black/30 p-1 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setTab("update_price")}
            className={`flex items-center justify-center gap-1 rounded-xl py-2 transition active:scale-95 ${
              tab === "update_price"
                ? "bg-primary text-primary-foreground shadow"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Pencil className="h-3.5 w-3.5" />
            <span>Ubah Harga</span>
          </button>
          <button
            type="button"
            onClick={() => setTab("add_menu")}
            className={`flex items-center justify-center gap-1 rounded-xl py-2 transition active:scale-95 ${
              tab === "add_menu"
                ? "bg-primary text-primary-foreground shadow"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Tambah</span>
          </button>
          <button
            type="button"
            onClick={() => setTab("getok_alert")}
            className={`flex items-center justify-center gap-1 rounded-xl py-2 transition active:scale-95 ${
              tab === "getok_alert"
                ? "bg-destructive text-destructive-foreground shadow"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            <span>Getok</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
          {tab === "update_price" && (
            <>
              {warung.menu.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Belum ada menu di warung ini. Silakan gunakan tab "Tambah Menu".
                </p>
              ) : (
                <>
                  <div>
                    <label className="text-xs font-semibold text-foreground">
                      Pilih Menu yang Ingin Diubah
                    </label>
                    <select
                      value={selectedItemId}
                      onChange={(e) => {
                        setSelectedItemId(e.target.value);
                        const found = warung.menu.find((m) => m.id === e.target.value);
                        if (found) setUpdatedPrice(String(found.price));
                      }}
                      className="mt-1.5 h-11 w-full rounded-2xl border border-white/10 bg-black/30 px-3 text-xs text-foreground outline-none focus:border-primary"
                    >
                      {warung.menu.map((m) => (
                        <option key={m.id} value={m.id} className="bg-card text-foreground">
                          {m.name} (saat ini {formatRupiah(m.price)})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-foreground">
                      Harga Riil Terbaru (Rp)
                    </label>
                    <input
                      type="number"
                      value={updatedPrice}
                      onChange={(e) => setUpdatedPrice(e.target.value)}
                      placeholder="Contoh: 16000"
                      className="mt-1.5 h-11 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-foreground outline-none focus:border-primary"
                    />
                  </div>
                </>
              )}
            </>
          )}

          {tab === "add_menu" && (
            <>
              <div>
                <label className="text-xs font-semibold text-foreground">
                  Nama Menu / Minuman Baru
                </label>
                <input
                  type="text"
                  value={newMenuName}
                  onChange={(e) => setNewMenuName(e.target.value)}
                  placeholder="Contoh: Ayam Bakar Madu"
                  className="mt-1.5 h-11 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-foreground outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-xs font-semibold text-foreground">Kategori</label>
                  <select
                    value={newMenuCategory}
                    onChange={(e) => setNewMenuCategory(e.target.value as "makanan" | "minuman")}
                    className="mt-1.5 h-11 w-full rounded-2xl border border-white/10 bg-black/30 px-3 text-xs text-foreground outline-none focus:border-primary"
                  >
                    <option value="makanan" className="bg-card text-foreground">
                      Makanan
                    </option>
                    <option value="minuman" className="bg-card text-foreground">
                      Minuman
                    </option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground">Harga (Rp)</label>
                  <input
                    type="number"
                    value={newMenuPrice}
                    onChange={(e) => setNewMenuPrice(e.target.value)}
                    placeholder="Contoh: 18000"
                    className="mt-1.5 h-11 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-foreground outline-none focus:border-primary"
                  />
                </div>
              </div>
            </>
          )}

          {tab === "getok_alert" && (
            <>
              <div className="rounded-2xl border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive-foreground">
                <p className="font-bold flex items-center gap-1.5 text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  Peringatan Getok Harga
                </p>
                <p className="mt-1 text-muted-foreground text-[11px]">
                  Bantu sesama pembeli agar tidak tertipu harga yang sengaja ditembak mahal tanpa
                  daftar menu.
                </p>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground">Menu yang Dipesan</label>
                <input
                  type="text"
                  value={getokItemName}
                  onChange={(e) => setGetokItemName(e.target.value)}
                  placeholder="Contoh: Es Teh Manis / Nasi Ayam"
                  className="mt-1.5 h-11 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-foreground outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground">
                  Harga yang Ditagih (Rp)
                </label>
                <input
                  type="number"
                  value={getokPricePaid}
                  onChange={(e) => setGetokPricePaid(e.target.value)}
                  placeholder="Contoh: 15000 (untuk es teh)"
                  className="mt-1.5 h-11 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-foreground outline-none focus:border-primary"
                />
              </div>
            </>
          )}

          <div>
            <label className="text-xs font-semibold text-foreground">Nama Pelapor</label>
            <input
              type="text"
              value={reporterName}
              onChange={(e) => setReporterName(e.target.value)}
              placeholder="Nama kamu (misal: Budi / Anonim)"
              className="mt-1.5 h-11 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-foreground outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-foreground">
              Catatan / Bukti (Opsional)
            </label>
            <input
              type="text"
              value={reportNote}
              onChange={(e) => setReportNote(e.target.value)}
              placeholder="Contoh: Sudah lihat menu dinding baru / nota tertulis"
              className="mt-1.5 h-11 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-foreground outline-none focus:border-primary"
            />
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <label className="flex items-center gap-2.5 cursor-pointer text-xs font-semibold text-foreground">
              <input
                type="checkbox"
                checked={acceptsQris}
                onChange={(e) => setAcceptsQris(e.target.checked)}
                className="h-4 w-4 rounded accent-primary"
              />
              <CreditCard className="h-4 w-4 text-cyan-400" />
              <span>Warung ini menerima pembayaran QRIS</span>
            </label>
            <p className="mt-1 text-[11px] text-muted-foreground ml-6.5">
              Centang jika warung sudah menyediakan QRIS / e-wallet.
            </p>
          </div>

          <div className="mt-5 flex gap-2 pt-2 border-t border-white/10">
            <button
              type="submit"
              className={`h-11 flex-1 rounded-2xl text-xs font-bold transition active:scale-95 shadow-md ${
                tab === "getok_alert"
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : "bg-primary text-primary-foreground hover:bg-primary/90"
              }`}
            >
              {tab === "getok_alert" ? "Kirim Laporan Getok Harga" : "Simpan & Update Harga"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="h-11 rounded-2xl border border-white/10 bg-card px-4 text-xs font-semibold text-foreground hover:bg-muted"
            >
              Batal
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
