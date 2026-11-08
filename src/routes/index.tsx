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
import { BudgetModal } from "@/components/home/BudgetModal";
import { Chips, FILTERS, type Filter } from "@/components/home/Chips";
import {
  TopBar,
  type Remote,
  type SearchApi,
  type SearchHit,
} from "@/components/home/SearchDropdown";
import { WarungList } from "@/components/home/WarungList";

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
  OPEN_LABEL,
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

const SAMPLE_RADIUS_KM = 2;
const AREA_ZOOM = 15;
const MAX_LIST = 80;

type Focus = { lat: number; lng: number; zoom: number; animate: boolean };

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
