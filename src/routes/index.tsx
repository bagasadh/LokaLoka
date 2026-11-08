import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleDollarSign,
  Clock,
  Coffee,
  CreditCard,
  Dices,
  Flame,
  Heart,
  History,
  Loader2,
  LocateFixed,
  MapPin,
  Minus,
  Moon,
  Navigation,
  Plus,
  Receipt,
  Search,
  ShieldAlert,
  ShieldCheck,
  Star,
  Store,
  User,
  Utensils,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { BottomNav } from "@/components/BottomNav";
import GachaModal from "@/components/GachaModal";
import { Logo } from "@/components/Logo";
import RouteModal from "@/components/RouteModal";
import { Stars } from "@/components/WarungBits";
import { locate, useGeo } from "@/lib/geo";
import { calculateWarungPriceRadar } from "@/lib/price-radar";
import {
  POPULAR_FOOD_QUERIES,
  addRecentSearch,
  clearRecentSearches,
  getRecentSearches,
  removeRecentSearch,
} from "@/lib/search-history";
import {
  fetchNearbyEats,
  isNonFoodName,
  loadArea,
  saveArea,
  searchPlaces,
  type Area,
  type GeoPlace,
} from "@/lib/places";
import { actions, getWarung, isBookmarked, ratingOf, useStore } from "@/lib/store";
import {
  PLACEHOLDER_COVER,
  USER_LOCATION,
  WARUNGS,
  distanceKm,
  fitsBudget,
  formatAgo,
  formatDistance,
  getRepresentativeItem,
  getScheduleInsight,
  hoursLabel,
  isLateNightEatery,
  matchWarung,
  minPrice as getMinPrice,
  openState,
  ownerUpdatedMinAgo,
  receiptCount,
  servesKind,
  type MenuItem,
  type OpenState,
  type Review,
  type Warung,
} from "@/lib/warung-data";

const MapView = lazy(() => import("@/components/MapView"));

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Lokaloka — Warung di sekitarmu" },
      {
        name: "description",
        content: "Peta warung terdekat dengan menu, harga terbaru, dan ulasan pembeli asli.",
      },
      { property: "og:title", content: "Lokaloka — Warung di sekitarmu" },
      {
        property: "og:description",
        content: "Peta warung terdekat dengan menu, harga terbaru, dan ulasan pembeli asli.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

const FILTERS = [
  "Terdekat",
  "Buka sekarang",
  "Bisa QRIS",
  "Kuliner Malam",
  "Bebas Getok",
  "Favorit",
  "Rating 4+",
  "Ada Struk",
  "Makanan",
  "Minuman",
] as const;
type Filter = (typeof FILTERS)[number];

type BudgetOption = { label: string; desc: string; value: number };
const BUDGET_OPTIONS: readonly BudgetOption[] = [
  { label: "Semua Budget", desc: "Tampilkan semua warung tanpa batasan harga", value: 0 },
  { label: "≤ 10rb", desc: "Super hemat (gorengan, es teh, lontong, nasi kucing)", value: 10000 },
  {
    label: "≤ 15rb",
    desc: "Paling pas kantong mhs (nasi rames, mie ayam, ketoprak)",
    value: 15000,
  },
  { label: "≤ 20rb", desc: "Kenyang mantap (ayam geprek, nasi padang, soto)", value: 20000 },
  { label: "≤ 30rb", desc: "Makan puas (bebek goreng, iga, kafe & nongkrong)", value: 30000 },
] as const;
/** Warung contoh hanya ditampilkan kalau berada dalam jarak ini dari titik pencarian. */
const SAMPLE_RADIUS_KM = 2;
const AREA_ZOOM = 15;
const MAX_LIST = 80;

type Focus = { lat: number; lng: number; zoom: number; animate: boolean };
type Remote<T> = { status: "idle" | "loading" | "ok" | "error"; items: T[] };

const OPEN_LABEL: Record<OpenState, { text: string; cls: string }> = {
  open: { text: "Buka", cls: "text-success" },
  closed: { text: "Tutup", cls: "text-destructive" },
  unknown: { text: "Jam buka belum diketahui", cls: "text-muted-foreground" },
};

/** Cari tempat di peta (tertunda sebentar supaya tidak menembak API di tiap ketukan). */
function useGeocode(q: string, near: { lat: number; lng: number }): Remote<GeoPlace> {
  const [state, setState] = useState<Remote<GeoPlace>>({ status: "idle", items: [] });
  const { lat, lng } = near;
  useEffect(() => {
    const t = q.trim();
    if (t.length < 3) {
      setState({ status: "idle", items: [] });
      return;
    }
    const ac = new AbortController();
    setState((s) => ({ status: "loading", items: s.items }));
    const timer = setTimeout(() => {
      searchPlaces(t, { signal: ac.signal, near: { lat, lng } })
        .then((items) => setState({ status: "ok", items }))
        .catch(() => {
          if (!ac.signal.aborted) setState({ status: "error", items: [] });
        });
    }, 400);
    return () => {
      clearTimeout(timer);
      ac.abort();
    };
  }, [q, lat, lng]);
  return state;
}

type SearchHit = { w: Warung; item: MenuItem | null };

function Home() {
  const s = useStore();
  const geo = useGeo();
  const navigate = useNavigate();
  const locationEnabled = s.settings?.locationEnabled ?? true;
  const mapTheme = s.settings?.mapTheme ?? "dark";
  const [q, setQ] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [filters, setFilters] = useState<Filter[]>(["Terdekat"]);
  const [budget, setBudget] = useState<number>(0);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [gachaOpen, setGachaOpen] = useState(false);
  const [routeWarung, setRouteWarung] = useState<Warung | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<"carousel" | "list">("carousel");
  const [pinStyle, setPinStyle] = useState<"badge" | "compact">("badge");

  // Muat preferensi penanda warung dari localStorage di browser
  useEffect(() => {
    try {
      const saved = localStorage.getItem("lokaloka_pin_style");
      if (saved === "badge" || saved === "compact") {
        setPinStyle(saved);
      }
    } catch {
      // Abaikan jika localStorage tidak aktif
    }
  }, []);

  const togglePinStyle = useCallback(() => {
    setPinStyle((prev) => {
      const next = prev === "badge" ? "compact" : "badge";
      try {
        localStorage.setItem("lokaloka_pin_style", next);
      } catch {
        // Abaikan
      }
      toast.success(next === "badge" ? "Mode penanda: Harga & menu" : "Mode penanda: Pin ringkas");
      return next;
    });
  }, []);

  const cardRefs = useRef<Record<string, HTMLElement | null>>({});
  const [zoom, setZoom] = useState({ n: 0, d: 0 });
  const [focus, setFocus] = useState<Focus | null>(null);
  const [area, setArea] = useState<Area | null>(null);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [scanCoord, setScanCoord] = useState<{ lat: number; lng: number }>(() => {
    const saved = loadArea();
    return saved ? { lat: saved.lat, lng: saved.lng } : geo.loc;
  });
  const scanCoordRef = useRef(scanCoord);
  scanCoordRef.current = scanCoord;
  const viewDebounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const moveDebounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [nearby, setNearby] = useState<Remote<Warung>>({ status: "idle", items: [] });
  const [retry, setRetry] = useState(0);
  const [now] = useState(() => new Date());
  const places = useGeocode(q, geo.loc);

  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  // Otomatis geser carousel kartu warung ke kartu yang sedang dipilih
  useEffect(() => {
    if (!selected) return;
    const el = cardRefs.current[selected];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  }, [selected]);

  // Titik lokasi pengguna yang aktif: jika izin lokasi mati, gunakan titik bawaan Manggarai
  const effectiveUserLoc = useMemo(
    () => (locationEnabled ? geo.loc : USER_LOCATION),
    [locationEnabled, geo.loc],
  );

  // Titik pencarian: titik tengah peta saat ini (jika user menggeser peta), atau tempat yang dipilih di search, atau GPS kita
  const origin = useMemo(
    () => mapCenter ?? area ?? effectiveUserLoc,
    [mapCenter, area, effectiveUserLoc],
  );

  // Handler saat user selesai menggeser atau memperbesar peta
  const handleMapMoveEnd = useCallback((center: { lat: number; lng: number }) => {
    // 1. Selalu perbarui mapCenter dengan cepat (100ms) agar pusat pandang & kartu warung terdekat segera sinkron
    if (viewDebounceTimer.current) clearTimeout(viewDebounceTimer.current);
    viewDebounceTimer.current = setTimeout(() => {
      setMapCenter(center);
    }, 100);

    // 2. Jika warung terpilih sudah jauh dari pandangan (> 4.5 km), batalkan pilihan otomatis
    if (selectedRef.current) {
      setSelected((cur) => {
        if (!cur) return null;
        return cur;
      });
    }

    // 3. Cek apakah user bergeser cukup jauh dari titik pemindaian terakhir (>= 750 meter)
    const distFromLastScan = distanceKm(scanCoordRef.current, center);
    if (distFromLastScan < 0.75) {
      return;
    }

    // 4. Debounce pemindaian (350ms): responsif dan tidak menembak API berulang saat user masih menggeser
    if (moveDebounceTimer.current) clearTimeout(moveDebounceTimer.current);
    moveDebounceTimer.current = setTimeout(() => {
      setScanCoord(center);
    }, 350);
  }, []);

  // Kembalikan lokasi pencarian terakhir, atau coba deteksi GPS pengguna
  useEffect(() => {
    if (!locationEnabled) {
      setArea(null);
      saveArea(null);
      setScanCoord(USER_LOCATION);
      setFocus({ lat: USER_LOCATION.lat, lng: USER_LOCATION.lng, zoom: 16, animate: false });
      return;
    }
    const saved = loadArea();
    if (saved) {
      setArea(saved);
      const pt = { lat: saved.lat, lng: saved.lng };
      setScanCoord(pt);
      setFocus({ lat: saved.lat, lng: saved.lng, zoom: AREA_ZOOM, animate: false });
      return;
    }
    setScanCoord(geo.loc);
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      void locate().then((next) => {
        if (next.real && !loadArea()) {
          setScanCoord(next.loc);
          setFocus({ lat: next.loc.lat, lng: next.loc.lng, zoom: 16, animate: true });
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationEnabled]);

  // Deteksi warung di sekitar scanCoord (hanya berjalan saat berpindah area baru >= 750m)
  useEffect(() => {
    const ac = new AbortController();

    // Pertahankan daftar warung yang sudah ada saat sedang memuat area baru
    setNearby((prev) => ({ status: "loading", items: prev.items }));

    fetchNearbyEats({ lat: scanCoord.lat, lng: scanCoord.lng }, { signal: ac.signal })
      .then((newItems) => {
        setNearby((prev) => {
          // Bersihkan semua warung buatan lama (fallback) dan entitas non-kuliner (jalan, fasilitas, dll)
          const cleaned = prev.items.filter(
            (x) => !x.id.startsWith("fallback-") && !isNonFoodName(x.name),
          );
          const existingIds = new Set(cleaned.map((x) => x.id));
          const validNew = newItems.filter((x) => !existingIds.has(x.id) && !isNonFoodName(x.name));
          const merged = [...cleaned, ...validNew];
          // Bersihkan warung yang berada sangat jauh (> 15 km) dari area aktif
          const relevant = merged.filter((w) => distanceKm(w, scanCoord) <= 15);
          return { status: "ok", items: relevant };
        });
      })
      .catch(() => {
        if (!ac.signal.aborted) {
          setNearby((prev) => {
            const cleaned = prev.items.filter(
              (x) => !x.id.startsWith("fallback-") && !isNonFoodName(x.name),
            );
            return { status: "error", items: cleaned };
          });
        }
      });
    return () => ac.abort();
  }, [scanCoord, retry]);

  // Semua warung di sekitar titik pencarian: contoh bawaan + hasil deteksi peta (hanya tempat makan & minum murni)
  const candidates = useMemo(() => {
    const sample = WARUNGS.map((w) => getWarung(s, w.id)!).filter(
      (w) => distanceKm(origin, w) <= SAMPLE_RADIUS_KM && !isNonFoodName(w.name),
    );
    const seen = new Set(sample.map((w) => w.id));
    const detected = nearby.items.filter((w) => !seen.has(w.id) && !isNonFoodName(w.name));
    return [...sample, ...detected];
  }, [s, origin, nearby.items]);

  const list = useMemo(() => {
    let ws = candidates.map((w) => ({
      w,
      dist: distanceKm(origin, w),
      rating: ratingOf(s, w.id),
      state: openState(w, now),
    }));
    // Tampilkan warung dalam radius pandang sekitar titik pusat peta saat ini (3.5 km)
    ws = ws.filter((x) => x.dist <= 3.5);
    if (filters.includes("Buka sekarang")) ws = ws.filter((x) => x.state === "open");
    if (filters.includes("Bisa QRIS")) ws = ws.filter((x) => x.w.hasQris === true);
    if (filters.includes("Kuliner Malam")) ws = ws.filter((x) => isLateNightEatery(x.w));
    if (filters.includes("Bebas Getok")) {
      ws = ws.filter((x) => {
        const radar = calculateWarungPriceRadar(x.w, { neighborWarungs: WARUNGS });
        // Hanya loloskan warung yang terbukti ramah kantong atau wajar pasaran (bukan getok harga/markup tinggi)
        return radar.tier === "cheap" || radar.tier === "fair";
      });
    }
    if (filters.includes("Favorit")) ws = ws.filter((x) => isBookmarked(s, x.w.id));
    if (budget > 0) ws = ws.filter((x) => fitsBudget(x.w, budget));
    if (filters.includes("Rating 4+")) ws = ws.filter((x) => x.rating.avg >= 4);
    if (filters.includes("Ada Struk")) {
      ws = ws.filter((x) => receiptCount(s.reviews, x.w.id) > 0);
    }
    if (filters.includes("Makanan")) ws = ws.filter((x) => servesKind(x.w, "makanan"));
    if (filters.includes("Minuman")) ws = ws.filter((x) => servesKind(x.w, "minuman"));
    return ws.sort((a, b) => a.dist - b.dist).slice(0, MAX_LIST);
  }, [s, candidates, origin, filters, budget, now]);

  const mapWarungs = useMemo(() => list.map((x) => x.w), [list]);

  // Warung/menu yang cocok dengan teks search (tampil di dropdown & menyalakan pin peta)
  const hits: SearchHit[] = useMemo(() => {
    const qq = q.trim();
    if (!qq) return [];
    const out: SearchHit[] = [];
    for (const w of candidates) {
      const m = matchWarung(w, qq);
      if (m) out.push({ w, item: m.item });
      if (out.length >= 5) break;
    }
    return out;
  }, [q, candidates]);

  // Highlight pin di peta saat mengetik nama menu/warung
  const highlight = useMemo(() => {
    const qq = q.trim();
    if (!qq) return null;
    const out: Record<string, string> = {};
    for (const { w } of list) {
      const m = matchWarung(w, qq);
      if (!m) continue;
      if (m.item) {
        const shortItem = m.item.name.length > 10 ? m.item.name.slice(0, 9) + "…" : m.item.name;
        const k = Math.round(m.item.price / 1000);
        out[w.id] = `${shortItem} ${k}k`;
      } else {
        out[w.id] = "";
      }
    }
    return Object.keys(out).length > 0 ? out : null;
  }, [q, list]);

  const onSelect = useCallback((id: string | null) => {
    setSelected(id);
    if (id) setMobileView("carousel");
  }, []);

  const pickPlace = useCallback((p: GeoPlace) => {
    addRecentSearch(p.name);
    const a: Area = { name: p.name, lat: p.lat, lng: p.lng };
    const pt = { lat: p.lat, lng: p.lng };
    setArea(a);
    saveArea(a);
    setMapCenter(null);
    setScanCoord(pt);
    setFocus({ lat: p.lat, lng: p.lng, zoom: AREA_ZOOM, animate: true });
    setSelected(null);
    setQ("");
    setSearchOpen(false);
    setMobileView("carousel");
    (document.activeElement as HTMLElement | null)?.blur();
  }, []);

  const pickWarung = useCallback(
    (id: string) => {
      onSelect(id);
      setQ("");
      setSearchOpen(false);
      (document.activeElement as HTMLElement | null)?.blur();
    },
    [onSelect],
  );

  /** Kembali ke lokasi kita: hapus lokasi pencarian, minta GPS terbaru, dan pindahkan peta. */
  const goHome = useCallback(() => {
    setArea(null);
    saveArea(null);
    setMapCenter(null);
    setSelected(null);

    // Jika izin lokasi dimatikan, kembali ke titik default (Manggarai)
    if (!locationEnabled) {
      setScanCoord(USER_LOCATION);
      setFocus({ lat: USER_LOCATION.lat, lng: USER_LOCATION.lng, zoom: 16, animate: true });
      toast.info("GPS nonaktif. Menampilkan titik default (Manggarai)", {
        action: {
          label: "Aktifkan GPS",
          onClick: () => {
            actions.setSettings({ locationEnabled: true });
            void locate({ force: true }).then((next) => {
              if (next.real) {
                setScanCoord(next.loc);
                setFocus({ lat: next.loc.lat, lng: next.loc.lng, zoom: 16, animate: true });
              }
            });
          },
        },
      });
      return;
    }

    setScanCoord(geo.loc);
    setFocus({ lat: geo.loc.lat, lng: geo.loc.lng, zoom: 16, animate: true });
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      void locate({ force: true }).then((next) => {
        if (next.real) {
          setScanCoord(next.loc);
          setFocus({ lat: next.loc.lat, lng: next.loc.lng, zoom: 16, animate: true });
        }
      });
    }
  }, [geo.loc, locationEnabled]);

  const submitSearch = useCallback(() => {
    if (q.trim()) addRecentSearch(q.trim());
    if (hits[0]) pickWarung(hits[0].w.id);
    else if (places.items[0]) pickPlace(places.items[0]);
  }, [q, hits, places.items, pickWarung, pickPlace]);

  // Tutup dropdown search kalau mengetuk di luar kotak search
  useEffect(() => {
    if (!searchOpen) return;
    const close = (e: PointerEvent) => {
      if (!(e.target as Element | null)?.closest("[data-search-root]")) setSearchOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [searchOpen]);

  // Bersihkan timer saat unmount
  useEffect(() => {
    return () => {
      if (viewDebounceTimer.current) clearTimeout(viewDebounceTimer.current);
      if (moveDebounceTimer.current) clearTimeout(moveDebounceTimer.current);
    };
  }, []);

  const search: SearchApi = {
    open: searchOpen,
    setOpen: setSearchOpen,
    places,
    hits,
    pickPlace,
    pickWarung,
    submit: submitSearch,
  };

  const sel = list.find((x) => x.w.id === selected);

  const isPannedAway = useMemo(() => {
    if (!mapCenter) return false;
    const refPoint = area ?? geo.loc;
    return distanceKm(refPoint, mapCenter) > 0.6;
  }, [mapCenter, area, geo.loc]);

  const areaTitle = isPannedAway
    ? "Warung di area peta"
    : area
      ? `Warung di ${area.name}`
      : "Warung terdekat";
  const toggle = (f: Filter) =>
    setFilters((fs) => (fs.includes(f) ? fs.filter((x) => x !== f) : [...fs, f]));

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-background lg:grid lg:grid-cols-[400px_minmax(0,1fr)]">
      {/* Desktop sidebar */}
      <aside className="hidden h-dvh flex-col border-r border-white/10 bg-background lg:flex">
        <div className="border-b border-white/5 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Logo className="h-8 w-8 shrink-0" />
              <div className="flex items-center gap-2">
                <span className="font-display text-lg font-bold tracking-tight text-foreground">
                  Lokaloka
                </span>
                <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                  Radar Kuliner
                </span>
              </div>
            </div>
            <Link
              to={s.user?.ownerOf ? "/pemilik" : "/profil"}
              aria-label="Profil"
              className="flex items-center gap-2 rounded-full border border-white/10 bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition-all hover:bg-muted active:scale-95"
            >
              {s.user ? (
                <span className="grid h-5 w-5 place-items-center rounded-full bg-primary font-display text-[10px] font-bold text-primary-foreground">
                  {s.user.name.charAt(0).toUpperCase()}
                </span>
              ) : (
                <User className="h-3.5 w-3.5 text-muted-foreground" />
              )}
              <span>Profil</span>
            </Link>
          </div>
          <TopBar q={q} setQ={setQ} search={search} />
          <Chips
            filters={filters}
            toggle={toggle}
            area={area}
            onClearArea={goHome}
            budget={budget}
            setBudget={setBudget}
            onOpenGacha={() => setGachaOpen(true)}
            onOpenBudget={() => setBudgetOpen(true)}
            bookmarkCount={s.bookmarks?.length ?? 0}
            pinStyle={pinStyle}
            onTogglePinStyle={togglePinStyle}
          />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
          <div className="mb-2 flex items-center justify-between pb-1">
            <p className="font-display text-base font-semibold">
              {areaTitle} · {list.length}
            </p>
            <button
              type="button"
              onClick={() => setGachaOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-300 transition hover:bg-amber-500/20 active:scale-95"
            >
              <Dices className="h-3.5 w-3.5" />
              <span>Gacha Kuliner</span>
            </button>
          </div>
          <WarungList
            list={list}
            selected={selected}
            onSelect={onSelect}
            status={nearby.status}
            onRetry={() => setRetry((r) => r + 1)}
            reviews={s.reviews}
            bookmarks={s.bookmarks}
          />
        </div>
      </aside>

      <section className="absolute inset-0 lg:relative">
        <ClientOnly fallback={<div className="map-fallback absolute inset-0" />}>
          <Suspense fallback={<div className="map-fallback absolute inset-0" />}>
            <MapView
              center={origin}
              user={effectiveUserLoc}
              warungs={mapWarungs}
              selectedId={selected}
              onSelect={onSelect}
              onMoveEnd={handleMapMoveEnd}
              zoomDelta={zoom}
              focus={focus}
              pinStyle={pinStyle}
              preferredCategory={filters.includes("Minuman") ? "minuman" : undefined}
              mapTheme={mapTheme}
            />
          </Suspense>
        </ClientOnly>

        {/* Mobile top overlay: Integrated Radar Header */}
        <header
          className={`pointer-events-auto absolute inset-x-0 top-0 border-b border-white/10 bg-[#202020]/90 px-3 pt-safe pb-2.5 backdrop-blur-md shadow-float lg:hidden ${
            searchOpen ? "z-40" : "z-20"
          }`}
        >
          {/* Brand & Location status row */}
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <Logo className="h-7 w-7 shrink-0" />
              <div className="flex min-w-0 items-center gap-1.5">
                <span className="truncate font-display text-base font-bold tracking-tight text-foreground">
                  Lokaloka
                </span>
                <span className="shrink-0 rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-amber-300">
                  Radar Kuliner
                </span>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              {!locationEnabled ? (
                <Link
                  to="/settings"
                  aria-label="Izin lokasi nonaktif - buka pengaturan"
                  className="flex h-7 items-center gap-1 rounded-full border border-zinc-700 bg-zinc-800/80 px-2 text-xs text-zinc-400 transition-colors hover:text-foreground"
                >
                  <LocateFixed className="h-3 w-3 text-zinc-400" />
                  <span className="text-[11px]">GPS Mati</span>
                </Link>
              ) : nearby.status === "loading" ? (
                <div className="flex h-7 items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 text-xs text-amber-300">
                  <Loader2 className="h-3 w-3 animate-spin text-amber-400" />
                  <span className="text-[11px] font-medium">Memindai...</span>
                </div>
              ) : isPannedAway ? (
                <button
                  onClick={goHome}
                  aria-label="Kembali ke lokasi saya"
                  className="flex h-7 max-w-[130px] items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 text-xs font-medium text-amber-300 transition-colors hover:bg-amber-500/20"
                >
                  <Navigation className="h-3 w-3 shrink-0 text-amber-400" />
                  <span className="truncate">Area Peta</span>
                  <X className="h-3 w-3 shrink-0 text-amber-400/70" />
                </button>
              ) : area ? (
                <button
                  onClick={goHome}
                  aria-label={`Hapus lokasi pencarian ${area.name}`}
                  className="flex h-7 max-w-[130px] items-center gap-1 rounded-full border border-white/10 bg-white/10 px-2 text-xs font-medium text-foreground transition-colors hover:bg-white/15"
                >
                  <MapPin className="h-3 w-3 shrink-0 text-primary" />
                  <span className="truncate">{area.name}</span>
                  <X className="h-3 w-3 shrink-0 text-muted-foreground" />
                </button>
              ) : (
                <div className="flex h-7 items-center gap-1.5 rounded-full border border-white/5 bg-white/5 px-2 text-xs text-muted-foreground">
                  <span className="relative flex h-2 w-2 shrink-0">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  </span>
                  <span className="text-[11px]">Sekitar</span>
                </div>
              )}

              {/* Tombol Profil di Kanan Atas */}
              <Link
                to={s.user?.ownerOf ? "/pemilik" : "/profil"}
                aria-label="Profil"
                className="flex h-7 items-center gap-1.5 rounded-full border border-white/10 bg-white/10 px-2.5 text-xs font-semibold text-foreground transition-all hover:bg-white/20 active:scale-95"
              >
                {s.user ? (
                  <span className="grid h-4 w-4 place-items-center rounded-full bg-primary font-display text-[9px] font-bold text-primary-foreground">
                    {s.user.name.charAt(0).toUpperCase()}
                  </span>
                ) : (
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                )}
                <span>Profil</span>
              </Link>
            </div>
          </div>

          <TopBar q={q} setQ={setQ} search={search} />
          <Chips
            filters={filters}
            toggle={toggle}
            area={area}
            onClearArea={goHome}
            budget={budget}
            setBudget={setBudget}
            onOpenGacha={() => setGachaOpen(true)}
            onOpenBudget={() => setBudgetOpen(true)}
            bookmarkCount={s.bookmarks?.length ?? 0}
            pinStyle={pinStyle}
            onTogglePinStyle={togglePinStyle}
          />
        </header>

        {/* Desktop Map Controls (Gaya Penanda, Perbesar, Perkecil, Lokasi Saya) */}
        <div className="hidden lg:absolute lg:bottom-6 lg:right-6 lg:z-20 lg:flex lg:flex-col lg:items-center lg:gap-2">
          <button
            type="button"
            aria-label={
              pinStyle === "badge" ? "Ganti ke mode pin ringkas" : "Ganti ke mode harga & menu"
            }
            onClick={togglePinStyle}
            className="grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-card/90 text-foreground shadow-float backdrop-blur-sm transition-all hover:bg-white/10 active:scale-95"
            title={
              pinStyle === "badge"
                ? "Mode penanda: Tampilkan pin ringkas"
                : "Mode penanda: Tampilkan harga & menu"
            }
          >
            {pinStyle === "badge" ? (
              <MapPin className="h-5 w-5 text-amber-400" />
            ) : (
              <CircleDollarSign className="h-5 w-5 text-amber-400" />
            )}
          </button>
          <div className="flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-card/90 shadow-float backdrop-blur-sm">
            <button
              type="button"
              aria-label="Perbesar"
              onClick={() => setZoom((z) => ({ n: z.n + 1, d: 1 }))}
              className="grid h-12 w-12 place-items-center text-foreground transition-colors hover:bg-white/10 active:scale-95"
            >
              <Plus className="h-5 w-5" />
            </button>
            <div className="h-px bg-white/10" />
            <button
              type="button"
              aria-label="Perkecil"
              onClick={() => setZoom((z) => ({ n: z.n + 1, d: -1 }))}
              className="grid h-12 w-12 place-items-center text-foreground transition-colors hover:bg-white/10 active:scale-95"
            >
              <Minus className="h-5 w-5" />
            </button>
          </div>
          <button
            type="button"
            aria-label="Lokasi saya"
            onClick={goHome}
            className="grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-card/90 text-locate shadow-float backdrop-blur-sm active:scale-95"
          >
            <LocateFixed className="h-5 w-5" />
          </button>
        </div>

        {/* Selected warung card (desktop only) */}
        {sel && (
          <div className="hidden lg:block lg:absolute lg:bottom-6 lg:left-6 lg:z-30 lg:w-[360px]">
            <div className="rounded-3xl border border-white/10 bg-card/95 p-3.5 shadow-float backdrop-blur-sm">
              <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
                <img
                  src={sel.w.cover || PLACEHOLDER_COVER}
                  alt=""
                  className="h-16 w-16 rounded-2xl object-cover bg-muted border border-white/5"
                />
                <div className="min-w-0">
                  <p className="truncate font-display font-bold text-foreground">{sel.w.name}</p>
                  <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="shrink-0 font-bold text-foreground">
                      {sel.rating.avg ? sel.rating.avg.toFixed(1) : "–"}
                    </span>
                    <Stars value={sel.rating.avg} size={11} />
                    <span className="truncate">· {formatDistance(sel.dist)}</span>
                  </div>
                  <p className={`truncate text-xs ${OPEN_LABEL[sel.state].cls}`}>
                    {sel.state === "unknown"
                      ? hoursLabel(sel.w)
                      : `${OPEN_LABEL[sel.state].text} · ${hoursLabel(sel.w)}`}
                  </p>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <button
                    aria-label="Tutup"
                    onClick={() => setSelected(null)}
                    className="grid h-8 w-8 place-items-center rounded-full bg-muted/80 text-muted-foreground transition-colors hover:text-foreground active:scale-95"
                  >
                    ×
                  </button>
                  <button
                    type="button"
                    aria-label={
                      isBookmarked(s, sel.w.id) ? "Hapus dari favorit" : "Simpan ke favorit"
                    }
                    onClick={() => {
                      const added = actions.toggleBookmark(sel.w.id);
                      toast.success(
                        added ? `"${sel.w.name}" disimpan ke favorit ❤️` : "Dihapus dari favorit",
                      );
                    }}
                    className="grid h-8 w-8 place-items-center rounded-full bg-muted/80 text-muted-foreground transition hover:text-foreground active:scale-90"
                    title={isBookmarked(s, sel.w.id) ? "Hapus dari favorit" : "Simpan ke favorit"}
                  >
                    <Heart
                      className={`h-4 w-4 ${
                        isBookmarked(s, sel.w.id)
                          ? "fill-rose-500 text-rose-500"
                          : "text-muted-foreground"
                      }`}
                    />
                  </button>
                </div>
              </div>
              <button
                onClick={() => navigate({ to: "/warung/$id", params: { id: sel.w.id } })}
                className="mt-3 flex h-10 w-full items-center justify-center gap-1.5 rounded-full bg-primary text-xs font-semibold text-primary-foreground transition-transform hover:bg-primary/90 active:scale-95"
              >
                <span>Lihat menu & harga</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Mobile View: Horizontal Food Carousel or Full List Sheet */}
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
            <div className="absolute inset-x-0 bottom-dock z-30 pt-1 pb-1">
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
                      <button
                        type="button"
                        onClick={() => setGachaOpen(true)}
                        className="flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-amber-300 transition hover:bg-amber-500/25 active:scale-95"
                        title="Bingung mau makan apa? Putar Gacha!"
                      >
                        <Dices className="h-3 w-3" />
                        <span>Gacha</span>
                      </button>
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
                        className="flex items-center gap-1 rounded-full bg-white/5 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground active:scale-95"
                      >
                        <span>Daftar</span>
                        <ChevronUp className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1" />
                )}

                {/* Tombol Map Controls di Mobile (Gaya Pin & Lokasi Saya) */}
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    aria-label={
                      pinStyle === "badge"
                        ? "Ganti ke mode pin ringkas"
                        : "Ganti ke mode harga & menu"
                    }
                    onClick={togglePinStyle}
                    className="flex h-9 items-center gap-1 rounded-full border border-white/10 bg-[#242424]/95 px-2.5 text-xs font-semibold text-foreground shadow-float backdrop-blur-md transition-all active:scale-90"
                    title={
                      pinStyle === "badge"
                        ? "Mode penanda: Tampilkan pin ringkas"
                        : "Mode penanda: Tampilkan harga & menu"
                    }
                  >
                    {pinStyle === "badge" ? (
                      <>
                        <MapPin className="h-3.5 w-3.5 text-amber-400" />
                        <span className="text-[11px]">Pin</span>
                      </>
                    ) : (
                      <>
                        <CircleDollarSign className="h-3.5 w-3.5 text-amber-400" />
                        <span className="text-[11px]">Harga</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    aria-label="Lokasi saya"
                    onClick={goHome}
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/10 bg-[#242424]/95 text-locate shadow-float backdrop-blur-md transition-transform active:scale-90"
                  >
                    <LocateFixed className="h-4 w-4" />
                  </button>
                </div>
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
                            alt=""
                            className="h-18 w-18 shrink-0 rounded-2xl object-cover bg-muted border border-white/5"
                          />
                          <div className="min-w-0">
                            <div className="flex items-start justify-between gap-1.5">
                              <p className="truncate font-display text-sm font-bold text-foreground">
                                {w.name}
                              </p>
                              <div className="flex shrink-0 items-center gap-1">
                                <button
                                  type="button"
                                  aria-label={
                                    isBookmarked(s, w.id)
                                      ? "Hapus dari favorit"
                                      : "Simpan ke favorit"
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
                                    isBookmarked(s, w.id)
                                      ? "Hapus dari favorit"
                                      : "Simpan ke favorit"
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
                              navigate({ to: "/warung/$id", params: { id: w.id } });
                            }}
                            className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground transition-transform hover:bg-primary/90 active:scale-95"
                          >
                            <span>Lihat menu</span>
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
                            Data tempat makan berasal dari OpenStreetMap, jadi warung kecil bisa
                            saja belum terpetakan.
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

        {gachaOpen && (
          <GachaModal
            warungs={candidates}
            userLocation={origin}
            onClose={() => setGachaOpen(false)}
            onSelectWarung={(id) => {
              setGachaOpen(false);
              navigate({ to: "/warung/$id", params: { id } });
            }}
            onOpenRoute={(w) => {
              setGachaOpen(false);
              setRouteWarung(w);
            }}
          />
        )}

        {routeWarung && (
          <RouteModal from={geo.loc} warung={routeWarung} onClose={() => setRouteWarung(null)} />
        )}

        {budgetOpen && (
          <BudgetModal
            current={budget}
            onSelect={(val) => {
              setBudget(val);
              setBudgetOpen(false);
              toast.success(
                val > 0
                  ? `Filter aktif: Maksimal Rp ${val.toLocaleString("id-ID")}`
                  : "Filter budget dinonaktifkan",
              );
            }}
            onClose={() => setBudgetOpen(false)}
          />
        )}
      </section>
      <BottomNav />
    </main>
  );
}

function IconBtn({
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

interface SearchApi {
  open: boolean;
  setOpen: (v: boolean) => void;
  places: Remote<GeoPlace>;
  hits: SearchHit[];
  pickPlace: (p: GeoPlace) => void;
  pickWarung: (id: string) => void;
  submit: () => void;
}

function TopBar({
  q,
  setQ,
  user,
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
      <label className="flex h-11 min-w-0 items-center gap-2.5 rounded-2xl border border-white/10 bg-[#262626] px-3 shadow-inner transition-colors focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/50">
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
            className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:text-foreground active:scale-95"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </label>
      {showDropdown && <SearchDropdown q={q} setQ={setQ} search={search} />}
    </div>
  );
}

function SearchDropdown({
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
      className="absolute inset-x-0 top-full z-50 mt-2 max-h-[60dvh] overflow-y-auto overscroll-contain rounded-3xl border border-white/10 bg-card p-3 shadow-float"
    >
      {isQueryEmpty ? (
        <div className="space-y-3.5">
          {/* Kuliner Populer / Pencarian Cepat */}
          <div>
            <div className="mb-2 flex items-center gap-1.5 px-1 text-xs font-semibold text-muted-foreground">
              <Flame className="h-3.5 w-3.5 text-amber-400" />
              <span>Pencarian Cepat Kuliner</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {POPULAR_FOOD_QUERIES.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => handleSelectRecent(item.label)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-foreground transition-colors hover:border-amber-500/40 hover:bg-amber-500/10 active:scale-95"
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

function ResultRow({
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
      className="grid w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-white/5 active:bg-accent"
    >
      <span className="grid h-9 w-9 place-items-center rounded-full bg-muted/80 text-muted-foreground">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-foreground">{title}</span>
        {sub && <span className="block truncate text-xs text-muted-foreground">{sub}</span>}
      </span>
    </button>
  );
}

function Chips({
  filters,
  toggle,
  area,
  onClearArea,
  budget,
  setBudget,
  onOpenGacha,
  onOpenBudget,
  bookmarkCount,
  pinStyle,
  onTogglePinStyle,
}: {
  filters: Filter[];
  toggle: (f: Filter) => void;
  area: Area | null;
  onClearArea: () => void;
  budget: number;
  setBudget: (b: number) => void;
  onOpenGacha: () => void;
  onOpenBudget: () => void;
  bookmarkCount: number;
  pinStyle?: "badge" | "compact";
  onTogglePinStyle?: () => void;
}) {
  return (
    <div className="no-scrollbar -mx-3 mt-2.5 flex items-center gap-1.5 overflow-x-auto px-3 pb-0.5 lg:mx-0 lg:flex-wrap lg:px-0">
      {/* Tombol Acak / Gacha */}
      <button
        type="button"
        onClick={onOpenGacha}
        className="flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-amber-500/40 bg-gradient-to-r from-amber-500/20 to-orange-500/20 px-3 text-xs font-bold text-amber-300 shadow-xs transition-all hover:brightness-110 active:scale-95"
      >
        <Dices className="h-3.5 w-3.5 text-amber-400" />
        <span>Gacha</span>
      </button>

      {/* Mode Penanda Peta (Harga vs Pin) */}
      {onTogglePinStyle && (
        <button
          type="button"
          onClick={onTogglePinStyle}
          className="flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-white/10 bg-[#262626] px-3 text-xs font-medium text-foreground transition-all hover:bg-[#2e2e2e] active:scale-95"
          title="Ganti tampilan penanda warung di peta"
        >
          {pinStyle === "badge" ? (
            <>
              <CircleDollarSign className="h-3 w-3 text-amber-400" />
              <span>Mode: Harga</span>
            </>
          ) : (
            <>
              <MapPin className="h-3 w-3 text-amber-400" />
              <span>Mode: Pin</span>
            </>
          )}
        </button>
      )}

      {/* Filter Budget Mahasiswa */}
      <button
        type="button"
        onClick={onOpenBudget}
        className={`flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-xs font-medium transition-all active:scale-95 ${
          budget > 0
            ? "border border-amber-400/50 bg-amber-500/20 text-amber-300 font-semibold shadow-xs"
            : "border border-white/10 bg-[#262626] text-muted-foreground hover:bg-[#2e2e2e] hover:text-foreground"
        }`}
      >
        <CircleDollarSign className="h-3 w-3 text-amber-400" />
        <span>{budget > 0 ? `≤ Rp ${budget / 1000}rb` : "Budget"}</span>
        {budget > 0 ? (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              setBudget(0);
              toast.info("Filter budget dinonaktifkan");
            }}
            className="ml-0.5 -mr-1 grid h-4 w-4 place-items-center rounded-full hover:bg-white/20 active:scale-90"
            title="Reset filter budget"
          >
            <X className="h-2.5 w-2.5" />
          </span>
        ) : (
          <ChevronDown className="h-3 w-3 opacity-60" />
        )}
      </button>

      {/* Filter Favorit */}
      <button
        type="button"
        onClick={() => toggle("Favorit")}
        className={`flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-xs font-medium transition-all active:scale-95 ${
          filters.includes("Favorit")
            ? "bg-rose-500 text-white font-semibold shadow-sm"
            : "border border-white/10 bg-[#262626] text-muted-foreground hover:bg-[#2e2e2e] hover:text-foreground"
        }`}
      >
        <Heart
          className={`h-3 w-3 ${filters.includes("Favorit") ? "fill-white" : "text-rose-400"}`}
        />
        <span>Favorit</span>
        {bookmarkCount > 0 && <span className="opacity-80">({bookmarkCount})</span>}
      </button>

      {area && (
        <button
          onClick={onClearArea}
          aria-label={`Hapus lokasi pencarian ${area.name}`}
          className="flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-primary px-3 text-xs font-semibold text-primary-foreground shadow-sm transition-transform active:scale-95"
        >
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          <span className="max-w-[10rem] truncate">{area.name}</span>
          <X className="h-3.5 w-3.5 shrink-0" />
        </button>
      )}

      {FILTERS.filter((f) => f !== "Favorit").map((f) => {
        const on = filters.includes(f);
        return (
          <button
            key={f}
            onClick={() => toggle(f)}
            className={`flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-xs font-medium transition-all active:scale-95 ${
              on
                ? f === "Bebas Getok"
                  ? "bg-emerald-500 text-black font-semibold shadow-sm"
                  : f === "Bisa QRIS"
                    ? "bg-cyan-500 text-black font-semibold shadow-sm"
                    : f === "Kuliner Malam"
                      ? "bg-indigo-600 text-white font-semibold shadow-sm"
                      : "bg-foreground text-background font-semibold shadow-sm"
                : "border border-white/10 bg-[#262626] text-muted-foreground hover:bg-[#2e2e2e] hover:text-foreground"
            }`}
          >
            {f === "Terdekat" && <Navigation className="h-3 w-3" />}
            {f === "Buka sekarang" && <Clock className="h-3 w-3 text-emerald-400" />}
            {f === "Bisa QRIS" && <CreditCard className="h-3 w-3 text-cyan-400" />}
            {f === "Kuliner Malam" && <Moon className="h-3 w-3 text-indigo-400" />}
            {f === "Bebas Getok" && (
              <ShieldCheck className={`h-3.5 w-3.5 ${on ? "text-black" : "text-emerald-400"}`} />
            )}
            {f === "Rating 4+" && <Star className="h-3 w-3 fill-amber-400 text-amber-400" />}
            {f === "Ada Struk" && <Receipt className="h-3 w-3 text-sky-400" />}
            {f === "Makanan" && <Utensils className="h-3 w-3" />}
            {f === "Minuman" && <Coffee className="h-3 w-3" />}
            <span>{f}</span>
          </button>
        );
      })}
    </div>
  );
}

function BudgetModal({
  current,
  onSelect,
  onClose,
}: {
  current: number;
  onSelect: (val: number) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev === "hidden" ? "" : prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-xs transition-opacity sm:items-center sm:p-4">
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="budget-title"
        className="relative z-10 flex w-full max-w-md flex-col rounded-t-3xl border border-white/10 bg-[#202020] p-5 shadow-float sm:rounded-3xl animate-in fade-in slide-in-from-bottom-4 duration-200"
      >
        <div className="flex items-center justify-between border-b border-white/5 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-amber-500/15 text-amber-400">
              <CircleDollarSign className="h-5 w-5" />
            </span>
            <div>
              <h2 id="budget-title" className="font-display text-base font-bold text-foreground">
                Budget Mahasiswa
              </h2>
              <p className="text-xs text-muted-foreground">Pilih batas harga menu terendah</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="grid h-8 w-8 place-items-center rounded-full bg-white/5 text-muted-foreground transition hover:bg-white/10 hover:text-foreground active:scale-95"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 space-y-2">
          {BUDGET_OPTIONS.map((opt) => {
            const isSelected = current === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onSelect(opt.value)}
                className={`flex w-full items-center justify-between rounded-2xl border p-3 text-left transition active:scale-[0.99] ${
                  isSelected
                    ? "border-amber-400/60 bg-amber-500/15 shadow-sm"
                    : "border-white/5 bg-card/60 hover:border-white/15 hover:bg-card"
                }`}
              >
                <div className="min-w-0 pr-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-display text-sm font-bold ${
                        isSelected ? "text-amber-300" : "text-foreground"
                      }`}
                    >
                      {opt.label}
                    </span>
                    {opt.value > 0 && (
                      <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                        Maks. Rp {opt.value.toLocaleString("id-ID")}
                      </span>
                    )}
                  </div>
                  {opt.desc && <p className="mt-0.5 text-xs text-muted-foreground">{opt.desc}</p>}
                </div>

                <div
                  className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border transition ${
                    isSelected
                      ? "border-amber-400 bg-amber-400 text-black"
                      : "border-white/20 bg-transparent"
                  }`}
                >
                  {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                </div>
              </button>
            );
          })}
        </div>

        {current > 0 && (
          <button
            type="button"
            onClick={() => onSelect(0)}
            className="mt-3 flex h-10 w-full items-center justify-center rounded-full bg-white/5 text-xs font-semibold text-muted-foreground transition hover:bg-white/10 hover:text-foreground active:scale-95"
          >
            Hapus Filter Budget
          </button>
        )}
      </div>
    </div>
  );
}

function WarungList({
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
        {list.map(({ w, dist, rating, state }) => {
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
                  <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="shrink-0 font-bold text-foreground">
                      {rating.avg ? rating.avg.toFixed(1) : "Baru"}
                    </span>
                    {rating.avg > 0 && <Stars value={rating.avg} size={11} />}
                    <span className="shrink-0">({rating.count})</span>
                    <span className="truncate">· {w.category}</span>
                  </div>

                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                    <span className={`font-medium ${OPEN_LABEL[state].cls}`}>
                      {state === "unknown" ? "Jam buka ?" : OPEN_LABEL[state].text}
                    </span>
                    {timing.isClosingSoon && (
                      <span className="inline-flex items-center gap-0.5 rounded border border-amber-500/30 bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-amber-300">
                        <span>⏳ Tutup {timing.minutesLeft} mnt lagi</span>
                      </span>
                    )}
                    {timing.isLateNight && (
                      <span className="inline-flex items-center gap-0.5 rounded border border-indigo-500/30 bg-indigo-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-indigo-300">
                        <span>🌙 Kuliner Malam</span>
                      </span>
                    )}
                    {w.hasQris && (
                      <span className="inline-flex items-center gap-0.5 rounded border border-cyan-500/30 bg-cyan-500/10 px-1.5 py-0.5 text-[9px] font-medium text-cyan-300">
                        <CreditCard className="h-2.5 w-2.5" />
                        <span>QRIS</span>
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
                      <span className="inline-flex items-center gap-0.5 rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[9px] font-medium text-foreground">
                        <Receipt className="h-2.5 w-2.5 text-sky-400" />
                        <span>Ada Struk</span>
                      </span>
                    )}
                    {w.registered && (
                      <span className="inline-flex items-center gap-0.5 rounded border border-amber-500/25 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-medium text-amber-300">
                        <span>Harga Pemilik</span>
                      </span>
                    )}
                    {minPrice && (
                      <span className="text-muted-foreground">
                        · Mulai Rp {minPrice.toLocaleString("id-ID")}
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
                        added ? `"${w.name}" disimpan ke favorit ❤️` : "Dihapus dari favorit",
                      );
                    }}
                    className="grid h-8 w-8 place-items-center rounded-full bg-white/5 text-muted-foreground transition hover:bg-white/10 hover:text-foreground active:scale-90"
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
                      className="h-16 w-16 rounded-2xl object-cover sm:h-20 sm:w-20 bg-muted border border-white/5"
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
