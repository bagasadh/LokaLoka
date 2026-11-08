import { useSyncExternalStore } from "react";
import { USER_LOCATION } from "./warung-data";

/**
 * Lokasi pengguna dari GPS/browser (`navigator.geolocation`).
 * Kalau izin ditolak, browser tidak mendukung, atau gagal, tetap memakai titik bawaan
 * (`USER_LOCATION`, Manggarai) supaya aplikasi tetap bisa dipakai.
 */

export type GeoStatus = "idle" | "locating" | "ok" | "denied" | "unavailable" | "error";

export interface GeoState {
  loc: { lat: number; lng: number };
  status: GeoStatus;
  /** true kalau `loc` berasal dari perangkat, bukan titik bawaan. */
  real: boolean;
  /** akurasi dalam meter (kalau ada). */
  accuracy: number | null;
}

const LAST_KEY = "lokaloka-last-loc-v1";
const initial: GeoState = { loc: USER_LOCATION, status: "idle", real: false, accuracy: null };
let state: GeoState = initial;
let restored = false;
const listeners = new Set<() => void>();

function set(next: Partial<GeoState>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

/** Pakai lokasi terakhir yang tersimpan sambil menunggu GPS (supaya tidak lompat dari Manggarai). */
function restore() {
  if (restored || typeof window === "undefined") return;
  restored = true;
  try {
    // Jika izin lokasi dimatikan lewat pengaturan aplikasi, jangan pakai lokasi GPS terakhir
    const settingsRaw = localStorage.getItem("lokaloka-state-v1");
    if (settingsRaw) {
      const parsed = JSON.parse(settingsRaw);
      if (parsed.settings && parsed.settings.locationEnabled === false) {
        state = { loc: USER_LOCATION, status: "idle", real: false, accuracy: null };
        return;
      }
    }

    const raw = localStorage.getItem(LAST_KEY);
    if (!raw) return;
    const p = JSON.parse(raw) as { lat: number; lng: number };
    if (Number.isFinite(p.lat) && Number.isFinite(p.lng)) state = { ...state, loc: p, real: true };
  } catch {
    /* abaikan */
  }
}

/** Kembalikan titik lokasi pengguna ke default (Manggarai) saat izin GPS dimatikan. */
export function resetGeoToDefault() {
  state = { loc: USER_LOCATION, status: "idle", real: false, accuracy: null };
  restored = true;
  pending = null;
  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem(LAST_KEY);
      localStorage.removeItem("lokaloka_area");
    } catch {
      /* abaikan */
    }
  }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  restore();
  listeners.add(l);
  return () => listeners.delete(l);
}

export function getGeoState() {
  restore();
  return state;
}

let pending: Promise<GeoState> | null = null;

/** Minta lokasi sekarang. Aman dipanggil berulang: permintaan yang sedang jalan dipakai bersama. */
export function locate(opts: { timeoutMs?: number; force?: boolean } = {}): Promise<GeoState> {
  restore();
  if (pending) return pending;

  // Jika izin lokasi dimatikan lewat pengaturan aplikasi dan tidak dipaksa oleh pengguna
  if (typeof window !== "undefined" && !opts.force) {
    try {
      const raw = localStorage.getItem("lokaloka-state-v1");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.settings && parsed.settings.locationEnabled === false) {
          set({ status: "denied", real: false });
          return Promise.resolve(state);
        }
      }
    } catch {
      /* abaikan */
    }
  }

  if (typeof navigator === "undefined" || !navigator.geolocation) {
    set({ status: "unavailable" });
    return Promise.resolve(state);
  }
  set({ status: "locating" });
  pending = new Promise<GeoState>((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        try {
          localStorage.setItem(LAST_KEY, JSON.stringify(loc));
        } catch {
          /* abaikan */
        }
        set({ loc, status: "ok", real: true, accuracy: pos.coords.accuracy ?? null });
        resolve(state);
      },
      (err) => {
        set({ status: err.code === err.PERMISSION_DENIED ? "denied" : "error" });
        resolve(state);
      },
      { enableHighAccuracy: true, timeout: opts.timeoutMs ?? 10_000, maximumAge: 60_000 },
    );
  }).finally(() => {
    pending = null;
  });
  return pending;
}

export function useGeo(): GeoState {
  return useSyncExternalStore(subscribe, getGeoState, () => initial);
}

/** Kembalikan ke kondisi awal (dipakai test). */
export function resetGeo() {
  state = initial;
  restored = false;
  pending = null;
  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem(LAST_KEY);
    } catch {
      /* abaikan */
    }
  }
  listeners.forEach((l) => l());
}

export interface RouteInfo {
  distanceKm: number;
  durationMin: number;
  points: [number, number][]; // [lat, lng]
}

/**
 * Mengambil jalur rute jalan raya terdekat menggunakan OSRM (Open Source Routing Machine).
 * Jika jaringan OSRM bermasalah, otomatis memberikan fallback jarak lurus tanpa gagal.
 */
export async function fetchRoute(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  signal?: AbortSignal,
): Promise<RouteInfo> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
    const init: RequestInit = { headers: { Accept: "application/json" } };
    if (signal) init.signal = signal;
    const res = await fetch(url, init);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as {
      code?: string;
      routes?: {
        distance: number;
        duration: number;
        geometry: { coordinates: [number, number][] };
      }[];
    };
    const r = data.routes?.[0];
    if (data.code === "Ok" && r) {
      return {
        distanceKm: Math.round((r.distance / 1000) * 10) / 10,
        durationMin: Math.max(1, Math.round(r.duration / 60)),
        points: r.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
      };
    }
  } catch {
    /* fallback jalur lurus */
  }

  // Hitung jarak lurus sebagai cadangan aman jika OSRM sedang lambat/offline
  const R = 6371;
  const dLat = ((to.lat - from.lat) * Math.PI) / 180;
  const dLng = ((to.lng - from.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((from.lat * Math.PI) / 180) *
      Math.cos((to.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const dist = Math.max(0.1, Math.round(R * c * 10) / 10);

  return {
    distanceKm: dist,
    durationMin: Math.max(1, Math.round((dist / 30) * 60)),
    points: [
      [from.lat, from.lng],
      [to.lat, to.lng],
    ],
  };
}
