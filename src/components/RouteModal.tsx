import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import {
  Bike,
  Car,
  Clock,
  ExternalLink,
  Flame,
  Footprints,
  Loader2,
  Navigation,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react";
import "leaflet/dist/leaflet.css";
import "./osm-map.css";
import { fetchRoute, type RouteInfo } from "@/lib/geo";
import { useStore } from "@/lib/store";
import type { Warung } from "@/lib/warung-data";

type LeafletLib = typeof Leaflet;
type TravelMode = "motor" | "mobil" | "jalan";

interface RouteModalProps {
  from: { lat: number; lng: number };
  warung: Warung;
  onClose: () => void;
}

function getFoodEmoji(name: string, category: string): string {
  const text = (name + " " + category).toLowerCase();
  if (
    text.includes("kopi") ||
    text.includes("cafe") ||
    text.includes("kafe") ||
    text.includes("tea") ||
    text.includes("teh")
  )
    return "☕";
  if (text.includes("bakso") || text.includes("mie") || text.includes("soto")) return "🍜";
  if (
    text.includes("nasi") ||
    text.includes("padang") ||
    text.includes("ayam") ||
    text.includes("warteg")
  )
    return "🍛";
  if (text.includes("sate") || text.includes("bbq")) return "🍢";
  if (text.includes("martabak") || text.includes("roti") || text.includes("kue")) return "🥞";
  if (text.includes("burger") || text.includes("pizza")) return "🍔";
  return "🍽️";
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

export default function RouteModal({ from, warung, onClose }: RouteModalProps) {
  const s = useStore();
  const mapTheme = s.settings?.mapTheme ?? "dark";

  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const polylineBorderRef = useRef<Leaflet.Polyline | null>(null);
  const polylineRef = useRef<Leaflet.Polyline | null>(null);
  const libRef = useRef<LeafletLib | null>(null);

  const [mode, setMode] = useState<TravelMode>("motor");
  const [route, setRoute] = useState<RouteInfo | null>(null);
  const [loading, setLoading] = useState(true);

  // Kunci scroll body saat modal dibuka
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow === "hidden" ? "" : prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  // Ambil data rute dari OSRM
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchRoute(from, { lat: warung.lat, lng: warung.lng }).then((res) => {
      if (!cancelled) {
        setRoute(res);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [from, warung.lat, warung.lng]);

  // Efek tema peta (gelap / terang)
  useEffect(() => {
    if (!mapContainer.current) return;
    mapContainer.current.classList.toggle("map-theme-light", mapTheme === "light");
  }, [mapTheme]);

  // Inisialisasi peta Leaflet
  useEffect(() => {
    let cancelled = false;
    let createdMap: Leaflet.Map | null = null;

    import("leaflet").then((mod) => {
      if (cancelled || !mapContainer.current) return;
      const L = (mod as unknown as { default?: LeafletLib }).default ?? (mod as LeafletLib);
      libRef.current = L;

      createdMap = L.map(mapContainer.current, {
        center: [(from.lat + warung.lat) / 2, (from.lng + warung.lng) / 2],
        zoom: 14,
        zoomControl: false,
        attributionControl: false,
      });

      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
      }).addTo(createdMap);

      // Marker Start: Lokasi Pengguna
      L.marker([from.lat, from.lng], {
        interactive: true,
        keyboard: false,
        icon: L.divIcon({
          html: '<div class="lokaloka-user-dot" title="Lokasi Kamu"><span class="pulse"></span><span class="dot"></span></div>',
          className: "lokaloka-pin",
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        }),
      })
        .addTo(createdMap)
        .bindPopup("<b>Titik Awal</b><br>Lokasi kamu saat ini");

      // Marker Finish: Warung Tujuan
      const emoji = getFoodEmoji(warung.name, warung.category);
      const name = escapeHtml(warung.name);
      L.marker([warung.lat, warung.lng], {
        interactive: true,
        icon: L.divIcon({
          html: `
            <div class="lokaloka-food-pin is-selected">
              <div class="lokaloka-badge">
                <span class="badge-icon">${emoji}</span>
                <span class="badge-label">${name}</span>
              </div>
              <div class="badge-pin-tip"></div>
            </div>
          `,
          className: "lokaloka-pin",
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        }),
      })
        .addTo(createdMap)
        .bindPopup(`<b>${name}</b><br>${escapeHtml(warung.address)}`);

      mapRef.current = createdMap;

      // Invalidate layout supaya tile tidak terpotong saat sheet animasi
      setTimeout(() => {
        if (!cancelled && createdMap) {
          createdMap.invalidateSize();
        }
      }, 150);
    });

    return () => {
      cancelled = true;
      createdMap?.remove();
      mapRef.current = null;
      polylineRef.current = null;
      polylineBorderRef.current = null;
    };
  }, [from, warung]);

  // Gambar polyline saat data rute selesai dimuat
  useEffect(() => {
    const L = libRef.current;
    const m = mapRef.current;
    if (!L || !m || !route) return;

    if (polylineRef.current) m.removeLayer(polylineRef.current);
    if (polylineBorderRef.current) m.removeLayer(polylineBorderRef.current);

    // Border line gelap agar rute tetap jelas di atas peta gelap
    polylineBorderRef.current = L.polyline(route.points, {
      color: "#0369a1",
      weight: 8,
      opacity: 0.6,
      lineCap: "round",
      lineJoin: "round",
    }).addTo(m);

    // Line utama berwarna cerah khas Google Maps rute tercepat
    polylineRef.current = L.polyline(route.points, {
      color: "#38bdf8",
      weight: 5,
      opacity: 0.95,
      lineCap: "round",
      lineJoin: "round",
    }).addTo(m);

    // Pusatkan peta ke seluruh lintasan rute
    const bounds = L.latLngBounds(route.points);
    m.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
  }, [route]);

  const fitRouteBounds = () => {
    const L = libRef.current;
    const m = mapRef.current;
    if (!L || !m || !route) return;
    const bounds = L.latLngBounds(route.points);
    m.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
  };

  // Perhitungan durasi, jarak, dan perkiraan tiba (ETA)
  const distKm = route ? route.distanceKm : 0;
  const distFormatted = distKm < 1 ? `${Math.round(distKm * 1000)} m` : `${distKm.toFixed(1)} km`;

  // Estimasi durasi per moda
  const motorMin = route ? Math.max(1, Math.round(route.durationMin * 0.75)) : null;
  const mobilMin = route ? Math.max(1, Math.round(route.durationMin)) : null;
  const jalanMin = route ? Math.max(1, Math.round((distKm / 4.5) * 60)) : null;

  const currentDurationMin = mode === "motor" ? motorMin : mode === "mobil" ? mobilMin : jalanMin;

  const durationText = currentDurationMin ? `${currentDurationMin} mnt` : "--";

  // Waktu tiba (ETA)
  const etaDate = currentDurationMin ? new Date(Date.now() + currentDurationMin * 60 * 1000) : null;
  const etaText = etaDate
    ? etaDate.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) + " WIB"
    : "";

  // Kalori & langkah sehat jika jalan kaki
  const calories = Math.round(distKm * 48);
  const steps = Math.round(distKm * 1350);

  let modeDesc = "";
  let googleTravelMode = "two_wheeler";

  if (mode === "motor") {
    modeDesc = "Rute tercepat & gesit via jalan raya/gang motor";
    googleTravelMode = "two_wheeler";
  } else if (mode === "mobil") {
    modeDesc = "Rute mobil via jalan utama & arteri";
    googleTravelMode = "driving";
  } else {
    modeDesc = "Rute pejalan kaki terdekat & hemat";
    googleTravelMode = "walking";
  }

  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${from.lat},${from.lng}&destination=${warung.lat},${warung.lng}&travelmode=${googleTravelMode}`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Rute ke ${warung.name}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-0 backdrop-blur-sm sm:p-4"
    >
      <div className="relative flex h-full w-full max-w-xl flex-col overflow-hidden bg-background shadow-2xl sm:h-[88vh] sm:rounded-3xl sm:border sm:border-border">
        {/* Top Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-border bg-background/95 px-4 pt-safe pb-3 backdrop-blur sm:pt-3">
          <div className="min-w-0 pr-3">
            <h2 className="truncate text-base font-bold text-foreground">Rute ke {warung.name}</h2>
            <p className="truncate text-xs text-muted-foreground">{warung.address}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup petunjuk rute"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-secondary text-foreground hover:bg-muted active:scale-95 transition-transform"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Transport Modes Tabs */}
        <div className="grid grid-cols-3 gap-1.5 border-b border-border bg-card p-1.5 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setMode("motor")}
            className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 transition active:scale-95 ${
              mode === "motor"
                ? "bg-primary text-primary-foreground shadow"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Bike className="h-4 w-4 shrink-0" />
            <span className="font-bold">Motor</span>
            {motorMin && <span className="text-[11px] opacity-80">({motorMin} mnt)</span>}
          </button>
          <button
            type="button"
            onClick={() => setMode("jalan")}
            className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 transition active:scale-95 ${
              mode === "jalan"
                ? "bg-primary text-primary-foreground shadow"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Footprints className="h-4 w-4 shrink-0" />
            <span className="font-bold">Jalan Kaki</span>
            {jalanMin && <span className="text-[11px] opacity-80">({jalanMin} mnt)</span>}
          </button>
          <button
            type="button"
            onClick={() => setMode("mobil")}
            className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 transition active:scale-95 ${
              mode === "mobil"
                ? "bg-primary text-primary-foreground shadow"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Car className="h-4 w-4 shrink-0" />
            <span className="font-bold">Mobil</span>
            {mobilMin && <span className="text-[11px] opacity-80">({mobilMin} mnt)</span>}
          </button>
        </div>

        {/* Leaflet Map Canvas */}
        <div className="relative flex-1 bg-black">
          <div
            ref={mapContainer}
            className={`h-full w-full ${mapTheme === "light" ? "map-theme-light" : ""}`}
            style={{ background: mapTheme === "light" ? "#f4f4f5" : "#141414" }}
          />

          {/* Loading Overlay */}
          {loading && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-background/60 backdrop-blur-xs">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
              <p className="text-xs font-semibold text-foreground">Menghitung rute terbaik…</p>
            </div>
          )}

          {/* Tombol Pusatkan Rute */}
          <button
            type="button"
            onClick={fitRouteBounds}
            title="Pusatkan seluruh rute"
            aria-label="Pusatkan seluruh rute"
            className="absolute right-3 bottom-3 z-10 grid h-10 w-10 place-items-center rounded-full bg-background/90 text-foreground shadow-lg backdrop-blur hover:bg-background active:scale-90 transition-transform"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>

        {/* Bottom Sheet Summary (Google Maps Style) */}
        <div className="shrink-0 border-t border-border bg-card p-4 pb-safe">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-baseline gap-2">
                <span className="font-display text-2xl font-black text-primary">
                  {durationText}
                </span>
                <span className="text-sm font-semibold text-muted-foreground">
                  ({distFormatted})
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                {etaText && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-foreground">
                    <Clock className="h-3.5 w-3.5 text-primary" />
                    <span>Tiba sekitar {etaText}</span>
                  </span>
                )}
                <span className="text-xs text-muted-foreground">· {modeDesc}</span>
              </div>
            </div>
          </div>

          {/* Insight Khusus per Moda */}
          {mode === "jalan" && (
            <div className="mt-3 flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2 text-xs text-muted-foreground border border-white/5">
              <span className="flex items-center gap-1 font-semibold text-amber-400">
                <Flame className="h-3.5 w-3.5 fill-current" />
                <span>~{calories} kkal terbakar</span>
              </span>
              <span>·</span>
              <span className="flex items-center gap-1 text-foreground">
                <Footprints className="h-3.5 w-3.5 text-primary" />
                <span>~{steps.toLocaleString("id-ID")} langkah sehat</span>
              </span>
            </div>
          )}

          {mode === "motor" && (
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-300 border border-amber-500/20">
              <Sparkles className="h-3.5 w-3.5 shrink-0" />
              <span>Paling direkomendasikan untuk jalanan lokal & hemat waktu</span>
            </div>
          )}

          <div className="mt-4 flex gap-2">
            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noreferrer"
              className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-primary px-4 text-sm font-bold text-primary-foreground shadow-lg transition active:scale-[0.98] hover:bg-primary/90"
            >
              <Navigation className="h-4 w-4 shrink-0 fill-current" />
              <span>Buka Petunjuk di Google Maps</span>
              <ExternalLink className="h-3.5 w-3.5 opacity-70" />
            </a>
            <button
              type="button"
              onClick={onClose}
              className="h-12 rounded-2xl border border-border bg-background px-4 text-sm font-semibold text-foreground transition hover:bg-muted active:scale-[0.98]"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
