import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import "./osm-map.css";
import { getRepresentativeItem, type Warung } from "@/lib/warung-data";

type LeafletLib = typeof Leaflet;

export type PinStyle = "badge" | "compact";

interface MapViewProps {
  center: { lat: number; lng: number };
  user: { lat: number; lng: number };
  warungs: Warung[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onMoveEnd?: (center: { lat: number; lng: number }, zoom: number) => void;
  recenterKey?: number;
  zoomDelta: { n: number; d: number };
  /** Pindahkan peta ke titik ini setiap kali objeknya berganti (mis. setelah memilih tempat). */
  focus?: { lat: number; lng: number; zoom: number; animate: boolean } | null;
  /**
   * Hasil pencarian menu/warung: id → label pengganti di badge (mis. "Es Teh 4k"), atau "" untuk
   * label bawaan. Pin yang tidak ada di sini diredupkan. `null` = tidak sedang mencari.
   */
  highlight?: Record<string, string> | null;
  /** Gaya penanda warung: "badge" (harga & menu) atau "compact" (pin minimalis). */
  pinStyle?: PinStyle | undefined;
  /** Prioritaskan kategori tertentu (mis. saat filter "Minuman" aktif). */
  preferredCategory?: "makanan" | "minuman" | undefined;
  /** Tema warna peta: "dark" (hitam) atau "light" (putih / terang). */
  mapTheme?: "dark" | "light" | undefined;
  /** Tampilkan titik penanda lokasi pengguna (GPS). */
  showUser?: boolean | undefined;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function pinHtml(
  w: Warung,
  index: number,
  style: PinStyle = "badge",
  preferredCategory?: "makanan" | "minuman",
) {
  const rep = getRepresentativeItem(w, preferredCategory);
  const emoji = rep.emoji;
  const label = escapeHtml(rep.label);
  // Jeda kecil berurutan supaya pin muncul bergelombang, dibatasi agar tidak terlalu lama
  const delay = Math.min(index, 20) * 18;
  const title = escapeHtml(w.name);

  if (style === "compact") {
    return `
      <div class="lokaloka-food-pin is-compact" style="--pin-delay:${delay}ms" title="${title}">
        <div class="lokaloka-compact-pin">
          <svg viewBox="0 0 24 30" class="compact-pin-svg" aria-hidden="true">
            <path d="M12 0 C6.48 0 2 4.48 2 10 C2 17 8 25 12 30 C16 25 22 17 22 10 C22 4.48 17.52 0 12 0 Z" class="compact-pin-body"/>
            <circle cx="12" cy="10" r="3.2" class="compact-pin-dot"/>
          </svg>
        </div>
      </div>
    `;
  }

  return `
    <div class="lokaloka-food-pin is-badge" style="--pin-delay:${delay}ms" title="${title}">
      <div class="lokaloka-badge">
        <span class="badge-icon">${emoji}</span>
        <span class="badge-label" data-default="${label}">${label}</span>
      </div>
      <div class="badge-pin-tip"></div>
    </div>
  `;
}

/** Ubah tampilan satu pin (dipilih / cocok pencarian / redup) tanpa membuat ulang marker. */
function stylePin(
  marker: Leaflet.Marker,
  opts: { selected: boolean; match: boolean; dimmed: boolean; label: string | null },
) {
  const root = marker.getElement()?.querySelector<HTMLElement>(".lokaloka-food-pin");
  if (!root) return;
  root.classList.toggle("is-selected", opts.selected);
  root.classList.toggle("is-match", opts.match);
  root.classList.toggle("is-dimmed", opts.dimmed);
  const labelEl = root.querySelector<HTMLElement>(".badge-label");
  if (labelEl) labelEl.textContent = opts.label || labelEl.dataset["default"] || "";
  marker.setZIndexOffset(opts.selected ? 1000 : opts.match ? 500 : 0);
}

/** Hitung bujur terdekat pada salinan peta agar transisi pan/fly tidak terbang 360 derajat */
function nearestLng(curLng: number, targetLng: number): number {
  return targetLng + Math.round((curLng - targetLng) / 360) * 360;
}

const WORLD_OFFSETS = [-360, 0, 360];

/** Peta gratis tanpa kunci API: OpenStreetMap + tampilan gelap dari CARTO. */
export default function MapView({
  center,
  user,
  warungs,
  selectedId,
  onSelect,
  onMoveEnd,
  recenterKey,
  zoomDelta,
  focus,
  highlight = null,
  pinStyle = "badge",
  preferredCategory,
  mapTheme = "dark",
  showUser = true,
}: MapViewProps) {
  const el = useRef<HTMLDivElement>(null);
  const lib = useRef<LeafletLib | null>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const pins = useRef<Leaflet.LayerGroup | null>(null);
  const userMarkers = useRef<Leaflet.LayerGroup | null>(null);
  const programmaticUntil = useRef(0);
  const lastPanIdRef = useRef<string | null>(null);
  const [ready, setReady] = useState(false);
  const [pinsVersion, setPinsVersion] = useState(0);

  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onMoveEndRef = useRef(onMoveEnd);
  onMoveEndRef.current = onMoveEnd;

  // Buat peta (hanya di browser, Leaflet butuh `window`)
  useEffect(() => {
    let cancelled = false;
    let created: Leaflet.Map | null = null;
    import("leaflet").then((mod) => {
      if (cancelled || !el.current) return;
      const L = (mod as unknown as { default?: LeafletLib }).default ?? (mod as LeafletLib);
      lib.current = L;
      created = L.map(el.current, {
        center: [center.lat, center.lng],
        zoom: 16,
        minZoom: 3,
        zoomControl: false,
        attributionControl: false,
        worldCopyJump: true,
        // Kunci batas kutub utara & selatan (agar tidak bablas ke ruang abu-abu kosong),
        // sementara arah horizontal (bujur) tetap bebas tak terbatas (-Infinity ke Infinity)
        maxBounds: [
          [-85.05112878, -Infinity],
          [85.05112878, Infinity],
        ],
        maxBoundsViscosity: 1.0,
      });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(created);
      L.control.attribution({ prefix: false, position: "bottomright" }).addTo(created);

      // Deselect saat klik area kosong peta
      created.on("click", () => {
        onSelectRef.current(null);
      });

      // Deteksi aksi langsung pengguna (drag/touch/mouse):
      // Batalkan flag penahan programatik agar interaksi manual tidak pernah tertelan
      const onUserGesture = () => {
        programmaticUntil.current = 0;
      };
      created.on("dragstart", onUserGesture);
      created.on("touchstart", onUserGesture);
      created.on("mousedown", onUserGesture);

      // Deteksi saat user selesai menggeser atau memperbesar peta (abaikan pergerakan otomatis/programatik)
      created.on("moveend", () => {
        if (!created) return;
        if (Date.now() < programmaticUntil.current) {
          return;
        }
        const c = created.getCenter().wrap();
        onMoveEndRef.current?.({ lat: c.lat, lng: c.lng }, created.getZoom());
      });

      pins.current = L.layerGroup().addTo(created);
      userMarkers.current = L.layerGroup().addTo(created);
      map.current = created;
      setReady(true);
    });
    return () => {
      cancelled = true;
      created?.remove();
      map.current = null;
      pins.current = null;
      userMarkers.current = null;
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Penanda warung (dirender pada salinan dunia -360, 0, +360 agar scroll 360 derajat selalu ada titiknya).
  // Hanya dibuat ulang kalau daftar warung berubah; pilihan & hasil pencarian diubah lewat `stylePin`.
  const markers = useRef<Map<string, Leaflet.Marker[]>>(new Map());

  useEffect(() => {
    const L = lib.current;
    if (!ready || !L || !pins.current) return;
    pins.current.clearLayers();
    markers.current = new Map();
    warungs.forEach((w, i) => {
      const html = pinHtml(w, i, pinStyle, preferredCategory);
      const list = WORLD_OFFSETS.map((offset) =>
        L.marker([w.lat, w.lng + offset], {
          title: w.name,
          icon: L.divIcon({
            html,
            className: "lokaloka-pin",
            iconSize: [0, 0],
            iconAnchor: [0, 0],
          }),
        })
          .on("click", (e) => {
            L.DomEvent.stopPropagation(e);
            if (selectedIdRef.current === w.id) {
              onSelectRef.current(null);
            } else {
              onSelectRef.current(w.id);
            }
          })
          .addTo(pins.current!),
      );
      markers.current.set(w.id, list);
    });
    setPinsVersion((v) => v + 1);
  }, [ready, warungs, pinStyle, preferredCategory]);

  // Terapkan status dipilih / cocok pencarian ke semua pin
  useEffect(() => {
    if (!ready) return;
    markers.current.forEach((list, id) => {
      const searching = !!highlight;
      const label = highlight?.[id];
      const match = searching && label !== undefined;
      list.forEach((m) =>
        stylePin(m, {
          selected: id === selectedId,
          match,
          dimmed: searching && !match && id !== selectedId,
          label: match ? label! : null,
        }),
      );
    });
  }, [ready, pinsVersion, selectedId, highlight]);

  // Efek perubahan tema warna peta (hitam / putih)
  useEffect(() => {
    if (!el.current) return;
    el.current.classList.toggle("map-theme-light", mapTheme === "light");
  }, [mapTheme]);

  // Titik lokasi kamu (selalu tampil: di GPS riil saat aktif, atau di Manggarai saat nonaktif)
  useEffect(() => {
    const L = lib.current;
    if (!ready || !L || !userMarkers.current) return;
    userMarkers.current.clearLayers();
    WORLD_OFFSETS.forEach((offset) => {
      L.marker([user.lat, user.lng + offset], {
        interactive: false,
        keyboard: false,
        zIndexOffset: 2000,
        icon: L.divIcon({
          html: '<div class="lokaloka-user-dot"><span class="pulse"></span><span class="dot"></span></div>',
          className: "lokaloka-pin",
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        }),
      }).addTo(userMarkers.current!);
    });
  }, [ready, user, showUser]);

  useEffect(() => {
    if (ready && recenterKey && map.current) {
      programmaticUntil.current = Date.now() + 500;
      const curLng = map.current.getCenter().lng;
      map.current.panTo([user.lat, nearestLng(curLng, user.lng)]);
    }
  }, [ready, recenterKey, user]);

  useEffect(() => {
    const m = map.current;
    if (!ready || !m || !focus) return;
    programmaticUntil.current = Date.now() + (focus.animate ? 1400 : 400);
    const curLng = m.getCenter().lng;
    const at: Leaflet.LatLngExpression = [focus.lat, nearestLng(curLng, focus.lng)];
    if (focus.animate) m.flyTo(at, focus.zoom, { duration: 1.2 });
    else m.setView(at, focus.zoom, { animate: false });
  }, [ready, focus]);

  useEffect(() => {
    if (!ready || !map.current) return;
    if (!selectedId) {
      lastPanIdRef.current = null;
      return;
    }
    // Hanya pan kamera jika pilihan warung benar-benar berubah ke warung baru (jangan pan berulang kali saat warungs update)
    if (selectedId === lastPanIdRef.current) return;
    lastPanIdRef.current = selectedId;

    const w = warungs.find((x) => x.id === selectedId);
    if (w) {
      programmaticUntil.current = Date.now() + 500;
      const curLng = map.current.getCenter().lng;
      map.current.panTo([w.lat, nearestLng(curLng, w.lng)]);
    }
  }, [ready, selectedId, warungs]);

  useEffect(() => {
    if (ready && zoomDelta.n && map.current)
      map.current.setZoom(map.current.getZoom() + zoomDelta.d);
  }, [ready, zoomDelta]);

  // `isolate` menahan z-index internal Leaflet supaya tidak menutupi search bar & panel bawah
  return (
    <div className="absolute inset-0 isolate bg-background">
      <div
        ref={el}
        className={`h-full w-full ${mapTheme === "light" ? "map-theme-light" : ""}`}
        style={{ background: mapTheme === "light" ? "#f4f4f5" : "#202020" }}
      />
    </div>
  );
}
