import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Clock,
  CreditCard,
  Heart,
  MapPin,
  MessageSquare,
  Moon,
  Navigation,
  Pencil,
  Phone,
  Plus,
  Receipt,
  Share2,
  Sparkles,
  Utensils,
} from "lucide-react";
import { toast } from "sonner";
import { SourceBadge, Stars } from "@/components/WarungBits";
import RouteModal from "@/components/RouteModal";
import { PriceRadarCard, RadarInfoModal } from "@/components/warung/PriceRadarCard";
import { ReceiptModal } from "@/components/warung/ReceiptModal";
import { ReviewSheet } from "@/components/warung/ReviewSheet";
import { DiscussionSection } from "@/components/warung/DiscussionSection";
import { ReportPriceModal } from "@/components/warung/ReportPriceModal";
import { useGeo } from "@/lib/geo";
import { fetchPlaceById, getKnownPlace } from "@/lib/places";
import { analyzeMenuItemPrice, calculateWarungPriceRadar, type PriceTier } from "@/lib/price-radar";
import { actions, getWarung, isBookmarked, ratingOf, useStore } from "@/lib/store";
import {
  PLACEHOLDER_COVER,
  USER_LOCATION,
  WARUNGS,
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
