import { PLACEHOLDER_COVER, WARUNGS, distanceKm, type MenuItem, type Warung } from "./warung-data";

/**
 * Pencarian tempat + deteksi warung di sekitarnya, tanpa API key:
 * - Pencarian tempat: Photon (OpenStreetMap), cadangan Nominatim.
 * - Deteksi warung/kafe/restoran: Overpass API (OpenStreetMap).
 * Catatan: warung kecil yang belum dipetakan di OpenStreetMap tidak akan terdeteksi.
 * Kalau nanti pindah ke Google Places, cukup ganti isi `searchPlaces` dan `fetchNearbyEats`.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

export interface GeoPlace extends LatLng {
  id: string;
  name: string;
  detail: string;
}

export interface Area extends LatLng {
  name: string;
}

/** Radius deteksi warung di sekitar titik pencarian. */
export const NEARBY_RADIUS_M = 1200;

const PHOTON_URL = "https://photon.komoot.io/api/";
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const OVERPASS_URLS = [
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://lz4.overpass-api.de/api/interpreter",
  "https://z.overpass-api.de/api/interpreter",
  "https://overpass-api.de/api/interpreter",
];
/** Batas waktu tiap permintaan ke satu server Overpass sebelum pindah ke server berikutnya. */
const OVERPASS_TIMEOUT_MS = 8_000;
/** Berapa putaran mencoba semua server sebelum menyerah, dan jeda awal antar putaran. */
const OVERPASS_ROUNDS = 1;
const OVERPASS_BACKOFF_MS = 500;

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal: signal ?? null, headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

// ---------------------------------------------------------------------------
// Cari tempat (geocoding)
// ---------------------------------------------------------------------------

interface PhotonFeature {
  geometry?: { coordinates?: [number, number] };
  properties?: Record<string, string | number | undefined>;
}

function uniqueJoin(parts: (string | undefined)[], skip?: string) {
  const out: string[] = [];
  for (const p of parts) {
    const v = p?.trim();
    if (v && v !== skip && !out.includes(v)) out.push(v);
  }
  return out.join(", ");
}

export function parsePhoton(data: { features?: PhotonFeature[] }): GeoPlace[] {
  const out: GeoPlace[] = [];
  for (const f of data.features ?? []) {
    const c = f.geometry?.coordinates;
    const p = f.properties ?? {};
    if (!c || c.length < 2) continue;
    const str = (k: string) => (typeof p[k] === "string" ? (p[k] as string) : undefined);
    const name = str("name") ?? str("street") ?? str("district") ?? str("city");
    if (!name) continue;
    const detail = uniqueJoin(
      [
        str("street"),
        str("district"),
        str("locality"),
        str("city"),
        str("county"),
        str("state"),
        str("country"),
      ],
      name,
    );
    out.push({
      id: `${str("osm_type") ?? "x"}${p["osm_id"] ?? out.length}`,
      name,
      detail,
      lat: c[1],
      lng: c[0],
    });
  }
  return dedupePlaces(out);
}

interface NominatimItem {
  place_id?: number;
  lat: string;
  lon: string;
  name?: string;
  display_name?: string;
}

export function parseNominatim(items: NominatimItem[]): GeoPlace[] {
  const out: GeoPlace[] = [];
  for (const it of items) {
    const lat = Number(it.lat);
    const lng = Number(it.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const parts = (it.display_name ?? "").split(",").map((x) => x.trim());
    const name = it.name || parts[0];
    if (!name) continue;
    out.push({
      id: `n${it.place_id ?? out.length}`,
      name,
      detail: uniqueJoin(parts.slice(1), name),
      lat,
      lng,
    });
  }
  return dedupePlaces(out);
}

/** Buang hasil kembar (nama sama dan titik berdekatan). */
function dedupePlaces(list: GeoPlace[]) {
  const out: GeoPlace[] = [];
  for (const p of list) {
    const dup = out.some(
      (q) =>
        q.name === p.name && Math.abs(q.lat - p.lat) < 0.002 && Math.abs(q.lng - p.lng) < 0.002,
    );
    if (!dup) out.push(p);
  }
  return out;
}

export async function searchPlaces(
  query: string,
  opts: { signal?: AbortSignal; near?: LatLng } = {},
): Promise<GeoPlace[]> {
  const q = query.trim();
  if (!q) return [];
  const bias = opts.near ? `&lat=${opts.near.lat}&lon=${opts.near.lng}` : "";
  try {
    const data = await getJson<{ features?: PhotonFeature[] }>(
      `${PHOTON_URL}?q=${encodeURIComponent(q)}&limit=6${bias}`,
      opts.signal,
    );
    const found = parsePhoton(data);
    if (found.length) return found;
  } catch (e) {
    if (opts.signal?.aborted) throw e;
    // lanjut ke Nominatim
  }
  const data = await getJson<NominatimItem[]>(
    `${NOMINATIM_URL}?format=jsonv2&limit=6&accept-language=id&q=${encodeURIComponent(q)}`,
    opts.signal,
  );
  return parseNominatim(data);
}

// ---------------------------------------------------------------------------
// Deteksi warung di sekitar titik (Overpass)
// ---------------------------------------------------------------------------

interface OverpassElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

const AMENITY_LABEL: Record<string, string> = {
  restaurant: "Restoran",
  cafe: "Kafe",
  fast_food: "Cepat saji",
  food_court: "Pujasera",
  ice_cream: "Es krim",
};

const AMENITY_KINDS: Record<string, MenuItem["category"][]> = {
  restaurant: ["makanan"],
  fast_food: ["makanan"],
  food_court: ["makanan"],
  cafe: ["minuman"],
  ice_cream: ["minuman"],
};

const CUISINE_LABEL: Record<string, string> = {
  indonesian: "Indonesia",
  javanese: "Jawa",
  sundanese: "Sunda",
  padang: "Padang",
  noodle: "Mie",
  chicken: "Ayam",
  fried_chicken: "Ayam goreng",
  seafood: "Seafood",
  coffee_shop: "Kopi",
  chinese: "Chinese",
  japanese: "Jepang",
  burger: "Burger",
  pizza: "Pizza",
  regional: "Khas daerah",
};

function titleCase(s: string) {
  const t = s.replace(/_/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

const pad2 = (n: string) => n.padStart(2, "0");

/**
 * Ambil jam buka hanya kalau polanya jelas dan sama setiap hari
 * ("24/7", "08:00-21:00", atau "Mo-Su 08:00-21:00"). Selain itu dianggap belum diketahui
 * supaya tidak menampilkan jam yang salah.
 */
export function parseOpeningHours(oh?: string): { open: string; close: string } | null {
  const s = oh?.trim();
  if (!s) return null;
  if (/^24\/7$/i.test(s)) return { open: "00:00", close: "24:00" };
  const m = /^(?:Mo-Su\s+)?(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/i.exec(s);
  if (!m) return null;
  return { open: `${pad2(m[1]!)}:${m[2]}`, close: `${pad2(m[3]!)}:${m[4]}` };
}

export function osmId(type: OverpassElement["type"], id: number) {
  return `osm-${type}-${id}`;
}

export const ALLOWED_FOOD_TYPES = new Set([
  "restaurant",
  "cafe",
  "fast_food",
  "food_court",
  "ice_cream",
  "bakery",
  "pastry",
  "bar",
  "pub",
  "biergarten",
]);

const FOOD_KEYWORDS = [
  "warung",
  "warteg",
  "mie",
  "bakso",
  "kopi",
  "cafe",
  "kafe",
  "resto",
  "makan",
  "sate",
  "nasi",
  "ayam",
  "bebek",
  "dapur",
  "kedai",
  "rm ",
  "rm.",
  "rumah makan",
  "angkringan",
  "pecel",
  "soto",
  "gudeg",
  "boba",
  "teh",
  "juice",
  "jus",
  "martabak",
  "gorengan",
  "seblak",
  "siomay",
  "batagor",
  "pempek",
  "burger",
  "pizza",
  "roti",
  "bakery",
  "coffee",
  "tea",
  "drink",
  "food",
  "snack",
  "lontong",
  "ketoprak",
  "bubur",
  "kue",
  "donat",
  "kuliner",
  "bites",
  "bistro",
  "eatery",
  "taichan",
  "geprek",
  "penyet",
  "rames",
  "padang",
  "sunda",
  "jawa",
  "dimsum",
  "steak",
  "seafood",
  "fried chicken",
  "noodle",
  "rawon",
  "gulai",
  "rendang",
  "tongseng",
  "mcdonald",
  "kfc",
  "richeese",
  "hokben",
  "starbucks",
  "jco",
  "chatime",
  "janji jiwa",
  "kopi kenangan",
  "point coffee",
  "dunkin",
];

const NON_FOOD_PREFIX_REGEX =
  /^(jalan|jl\.|jln\.|jln|gang|gg\.|gg|lorong|boulevard|blvd|tol|jalan tol|highway)\s+/i;

const NON_FOOD_FACILITY_REGEX =
  /^(rt\s*\d|rw\s*\d|kelurahan|kecamatan|kabupaten|desa|dusun|kampung|stasiun|halte|terminal|bandara|pelabuhan|gerbang tol|flyover|underpass|jembatan|kantor|polsek|polres|koramil|kodim|kua|disdukcapil|puskesmas|klinik|rumah sakit|rsud|apotek|apotik|masjid|musholla|mushola|gereja|pura|vihara|klenteng|makam|kuburan|tpu|spbu|pom bensin|pertashop|tambal ban|bengkel|car wash|cuci mobil|cuci motor|salon|barbershop|laundry|jne|j&t|sicepat|pos indonesia|sekolah|sd\s|smp\s|sma\s|smk\s|madrasah|pesantren|universitas|institut|politeknik|akademi|fakultas|kampus|kos\s|kost\s|kontrakan|penginapan|wisma|asrama|guest house|bank|atm|pegadaian|koperasi)\b/i;

/**
 * Filter penolak: mendeteksi apakah suatu nama adalah nama jalan, fasilitas umum,
 * atau tempat non-kuliner yang salah terindeks di OpenStreetMap / Nominatim.
 */
export function isNonFoodName(name: string): boolean {
  const trimmed = name.trim();
  if (trimmed.length < 2) return true;
  const lower = trimmed.toLowerCase();

  const hasFoodKeyword = FOOD_KEYWORDS.some((kw) => lower.includes(kw));

  // Jika nama diawali dengan penanda jalan/gang dan tidak mengandung kata kunci kuliner -> bukan warung
  if (NON_FOOD_PREFIX_REGEX.test(trimmed) && !hasFoodKeyword) {
    return true;
  }

  // Jika nama diawali dengan fasilitas umum dan tidak mengandung kata kunci kuliner -> bukan warung
  if (NON_FOOD_FACILITY_REGEX.test(trimmed) && !hasFoodKeyword) {
    return true;
  }

  // Jika nama persis nama jalan umum
  if (
    (lower.startsWith("jalan ") || lower.startsWith("jl. ") || lower.startsWith("gang ")) &&
    !hasFoodKeyword
  ) {
    return true;
  }

  return false;
}

export function elementToWarung(el: OverpassElement): Warung | null {
  const t = el.tags ?? {};
  const name = t["name"]?.trim();
  const lat = el.lat ?? el.center?.lat;
  const lng = el.lon ?? el.center?.lon;
  if (!name || lat == null || lng == null) return null;

  // Abaikan jalan, rel, batas, pembatas jalan, fasilitas umum non-kuliner
  if (t["highway"] || t["barrier"] || t["railway"] || t["boundary"] || t["place"] || t["leisure"]) {
    return null;
  }

  const amenity = t["amenity"] ?? "";
  const shop = t["shop"] ?? "";
  if (!ALLOWED_FOOD_TYPES.has(amenity) && !ALLOWED_FOOD_TYPES.has(shop)) {
    return null;
  }

  if (isNonFoodName(name)) {
    return null;
  }

  const cuisine = t["cuisine"]?.split(";")[0]?.trim().toLowerCase();
  const category = [
    AMENITY_LABEL[amenity] ?? "Tempat makan",
    cuisine ? (CUISINE_LABEL[cuisine] ?? titleCase(cuisine)) : "",
  ]
    .filter(Boolean)
    .join(" · ");

  const street = [t["addr:street"], t["addr:housenumber"]].filter(Boolean).join(" ");
  const address =
    t["addr:full"] ??
    ([street, t["addr:suburb"] ?? t["addr:village"], t["addr:city"]].filter(Boolean).join(", ") ||
      "Alamat belum tersedia");

  const hours = parseOpeningHours(t["opening_hours"]);
  const qrisTag = t["payment:qris"] === "yes" || t["payment:contactless"] === "yes";
  const isChainOrCafe =
    /kopi|coffee|cafe|kafe|mcdonald|kfc|richeese|starbucks|chatime|hokben/i.test(name);
  const hasQris = qrisTag || isChainOrCafe;

  return {
    id: osmId(el.type, el.id),
    name,
    category,
    lat,
    lng,
    address,
    phone: t["phone"] ?? t["contact:phone"] ?? "",
    open: hours?.open ?? "",
    close: hours?.close ?? "",
    cover: PLACEHOLDER_COVER,
    registered: false,
    hasQris,
    menu: [],
    source: "osm",
    kinds: AMENITY_KINDS[amenity] ?? ["makanan"],
  };
}

class HttpError extends Error {
  constructor(readonly status: number) {
    super(`HTTP ${status}`);
  }
}

/** Server yang terakhir berhasil dicoba duluan pada permintaan berikutnya. */
let preferredOverpass = 0;

function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

/** Satu permintaan dengan batas waktu sendiri, tetap ikut batal kalau `signal` pemanggil dibatalkan. */
async function postOverpass(url: string, query: string, signal?: AbortSignal) {
  const ac = new AbortController();
  const onAbort = () => ac.abort(signal?.reason);
  signal?.addEventListener("abort", onAbort, { once: true });
  const timer = setTimeout(() => ac.abort(new Error("timeout")), OVERPASS_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      signal: ac.signal,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: `data=${encodeURIComponent(query)}`,
    });

    if (!res.ok) throw new HttpError(res.status);
    const json = (await res.json()) as { elements?: OverpassElement[] };
    return json.elements ?? [];
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

/**
 * Kirim query ke Overpass dengan cadangan: coba semua server (mulai dari yang terakhir berhasil),
 * lalu ulangi satu putaran lagi setelah jeda kalau semuanya sibuk (502/504/429/timeout).
 * Error 400 (query salah) tidak diulang karena hasilnya pasti sama.
 */
async function overpass(query: string, signal?: AbortSignal): Promise<OverpassElement[]> {
  let lastError: unknown;
  for (let round = 0; round < OVERPASS_ROUNDS; round++) {
    if (round > 0) await sleep(OVERPASS_BACKOFF_MS * 2 ** (round - 1), signal);
    for (let i = 0; i < OVERPASS_URLS.length; i++) {
      const idx = (preferredOverpass + i) % OVERPASS_URLS.length;
      try {
        const elements = await postOverpass(OVERPASS_URLS[idx]!, query, signal);
        preferredOverpass = idx;
        return elements;
      } catch (e) {
        if (signal?.aborted) throw e;
        if (e instanceof HttpError && e.status === 400) throw e;
        lastError = e;
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Overpass gagal");
}

interface NearbyCacheEntry {
  at: number;
  items: Warung[];
  center: LatLng;
}

const nearbyCache = new Map<string, NearbyCacheEntry>();
const NEARBY_TTL_MS = 10 * 60 * 1000;

// Cache hasil deteksi per area di localStorage: dipakai lagi saat semua server Overpass gagal,
// supaya daftar warung tidak tiba-tiba kosong di area yang pernah dibuka.
const STALE_KEY = "lokaloka-nearby-v1";
const STALE_MAX_AREAS = 20;
type StaleEntry = { at: number; items: Omit<Warung, "cover">[] };

function readStale(): Record<string, StaleEntry> {
  if (typeof window === "undefined") return {};
  try {
    const raw =
      (JSON.parse(localStorage.getItem(STALE_KEY) ?? "{}") as Record<string, StaleEntry>) ?? {};
    // Bersihkan semua warung dummy lama (fallback-) dan tempat non-kuliner (nama jalan, dll)
    for (const key of Object.keys(raw)) {
      if (raw[key]?.items) {
        raw[key]!.items = raw[key]!.items.filter(
          (item) => !item.id.startsWith("fallback-") && !isNonFoodName(item.name),
        );
      }
    }
    return raw;
  } catch {
    return {};
  }
}

function writeStale(key: string, items: Warung[]) {
  if (typeof window === "undefined") return;
  try {
    const all = readStale();
    all[key] = { at: Date.now(), items: items.map(({ cover: _cover, ...rest }) => rest) };
    const keys = Object.keys(all).sort((a, b) => all[b]!.at - all[a]!.at);
    for (const k of keys.slice(STALE_MAX_AREAS)) delete all[k];
    localStorage.setItem(STALE_KEY, JSON.stringify(all));
  } catch {
    /* penuh: lewati */
  }
}

interface NominatimFoodResult {
  place_id: number;
  osm_type: "node" | "way" | "relation";
  osm_id: number;
  lat: string;
  lon: string;
  class: string;
  type: string;
  name?: string;
  display_name: string;
}

function nominatimToWarung(item: NominatimFoodResult): Warung | null {
  // Hanya loloskan entitas yang benar-benar berkelas 'amenity' atau 'shop'
  if (item.class !== "amenity" && item.class !== "shop") {
    return null;
  }
  // Hanya tipe tempat makan & minum resmi
  if (!ALLOWED_FOOD_TYPES.has(item.type)) {
    return null;
  }

  const name = item.name?.trim() || item.display_name.split(",")[0]?.trim();
  const lat = parseFloat(item.lat);
  const lng = parseFloat(item.lon);
  if (!name || isNaN(lat) || isNaN(lng)) return null;

  // Tolak nama jalan, batas wilayah, atau fasilitas non-kuliner
  if (isNonFoodName(name)) {
    return null;
  }

  const type = item.type;
  const isDrink =
    type === "cafe" ||
    type === "bar" ||
    type === "pub" ||
    name.toLowerCase().includes("kopi") ||
    name.toLowerCase().includes("teh") ||
    name.toLowerCase().includes("coffee") ||
    name.toLowerCase().includes("juice") ||
    name.toLowerCase().includes("jus");

  const category =
    type === "cafe"
      ? "Kafe · Kopi"
      : type === "fast_food"
        ? "Cepat saji"
        : type === "ice_cream"
          ? "Es krim"
          : type === "food_court"
            ? "Pujasera"
            : type === "bakery"
              ? "Roti & Kue"
              : "Tempat makan";

  const isChainOrCafe =
    /kopi|coffee|cafe|kafe|mcdonald|kfc|richeese|starbucks|chatime|hokben/i.test(name);
  const hasQris = isChainOrCafe;

  return {
    id: osmId(item.osm_type || "node", item.osm_id),
    name,
    category,
    lat,
    lng,
    address: item.display_name,
    phone: "",
    open: "09:00",
    close: "21:00",
    cover: PLACEHOLDER_COVER,
    registered: false,
    hasQris,
    menu: [],
    source: "osm",
    kinds: isDrink ? ["minuman"] : ["makanan"],
  };
}

async function fetchNominatimEats(
  center: LatLng,
  radiusM: number,
  signal?: AbortSignal,
): Promise<Warung[]> {
  const latDelta = radiusM / 111000;
  const lngDelta = radiusM / (111000 * Math.cos((center.lat * Math.PI) / 180));
  const minLng = (center.lng - lngDelta).toFixed(4);
  const maxLng = (center.lng + lngDelta).toFixed(4);
  const minLat = (center.lat - latDelta).toFixed(4);
  const maxLat = (center.lat + latDelta).toFixed(4);

  const amenities = ["restaurant", "cafe", "fast_food"];
  const lists = await Promise.all(
    amenities.map(async (amenity) => {
      const url = `${NOMINATIM_URL}?format=json&amenity=${amenity}&viewbox=${minLng},${maxLat},${maxLng},${minLat}&bounded=1&limit=25`;
      try {
        const res = await fetch(url, {
          ...(signal ? { signal } : {}),
          headers: {
            Accept: "application/json",
            "User-Agent": "LokalokaNearbyBites/1.0 (contact: bagasadh@gmail.com)",
          },
        });
        if (!res.ok) return [];
        return ((await res.json()) as NominatimFoodResult[]) ?? [];
      } catch {
        return [];
      }
    }),
  );

  const flat = lists.flat();
  const seen = new Set<string>();
  const out: Warung[] = [];
  for (const item of flat) {
    const w = nominatimToWarung(item);
    if (w && !seen.has(w.id)) {
      seen.add(w.id);
      out.push(w);
    }
  }
  return out;
}

export async function fetchNearbyEats(
  center: LatLng,
  opts: { radiusM?: number; signal?: AbortSignal } = {},
): Promise<Warung[]> {
  const radius = opts.radiusM ?? NEARBY_RADIUS_M;
  const key = `${center.lat.toFixed(3)},${center.lng.toFixed(3)},${radius}`;
  const hit = nearbyCache.get(key);
  if (hit && Date.now() - hit.at < NEARBY_TTL_MS) return hit.items;

  // Optimasi spatial cache: jika ada cache dalam radius 600m yang masih fresh, gunakan langsung
  for (const entry of nearbyCache.values()) {
    if (Date.now() - entry.at < NEARBY_TTL_MS && distanceKm(entry.center, center) < 0.6) {
      return entry.items;
    }
  }

  const query =
    `[out:json][timeout:10];` +
    `(` +
    `node(around:${radius},${center.lat},${center.lng})["amenity"~"^(restaurant|cafe|fast_food|food_court|ice_cream)$"]["name"];` +
    `way(around:${radius},${center.lat},${center.lng})["amenity"~"^(restaurant|cafe|fast_food|food_court|ice_cream)$"]["name"];` +
    `);out center tags 80;`;
  let items: Warung[] = [];
  let overpassError: unknown = null;
  try {
    const elements = await overpass(query, opts.signal);
    items = elements.map(elementToWarung).filter((w): w is Warung => !!w);
  } catch (e) {
    if (opts.signal?.aborted) throw e;
    overpassError = e;
  }

  // Jika Overpass gagal (mis. 406 Not Acceptable / timeout) atau kosong, gunakan Nominatim untuk mengambil warung riil
  if (items.length === 0 && !opts.signal?.aborted) {
    try {
      items = await fetchNominatimEats(center, radius, opts.signal);
    } catch {
      /* abaikan */
    }
  }

  // Jika masih kosong, coba cache stale sebelumnya
  if (items.length === 0) {
    const stale = readStale()[key];
    if (stale) {
      items = stale.items.map((w) => ({ ...w, cover: PLACEHOLDER_COVER }));
    }
  }

  // Jika Overpass kosong (bukan error) dan titik berada dekat Manggarai/Jakarta (< 3.5km),
  // gunakan data warung bawaan agar pengguna tidak melihat layar kosong
  if (items.length === 0 && !overpassError) {
    const nearbySamples = WARUNGS.filter((w) => distanceKm(center, w) <= 3.5);
    if (nearbySamples.length > 0) {
      items = nearbySamples;
    }
  }

  if (items.length === 0 && overpassError) {
    throw overpassError instanceof Error ? overpassError : new Error("Gagal mengambil warung");
  }

  if (items.length > 0) {
    nearbyCache.set(key, { at: Date.now(), items, center });
    writeStale(key, items);
    rememberPlaces(items);
  }

  return items;
}

/** Ambil satu tempat berdasarkan id (misalnya saat link `/warung/osm-node-123` dibuka langsung). */
export async function fetchPlaceById(id: string, signal?: AbortSignal): Promise<Warung | null> {
  const m = /^osm-(node|way|relation)-(\d+)$/.exec(id);
  if (!m) return null;
  const elements = await overpass(
    `[out:json][timeout:15];${m[1]}(${m[2]});out center tags;`,
    signal,
  );
  const w = elements.map(elementToWarung).find((x): x is Warung => !!x) ?? null;
  if (w) rememberPlaces([w]);
  return w;
}

// ---------------------------------------------------------------------------
// Cache tempat yang pernah terdeteksi (supaya halaman profil bisa membukanya)
// ---------------------------------------------------------------------------

const known = new Map<string, Warung>();
const KNOWN_MAX = 300;
const KNOWN_KEY = "lokaloka-places-v1";
let hydrated = false;

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = sessionStorage.getItem(KNOWN_KEY);
    if (!raw) return;
    for (const w of JSON.parse(raw) as Omit<Warung, "cover">[])
      known.set(w.id, { ...w, cover: PLACEHOLDER_COVER });
  } catch {
    /* abaikan */
  }
}

export function rememberPlaces(list: Warung[]) {
  hydrate();
  for (const w of list) {
    known.delete(w.id);
    known.set(w.id, w);
  }
  while (known.size > KNOWN_MAX) known.delete(known.keys().next().value!);
  if (typeof window === "undefined") return;
  try {
    const slim = [...known.values()].map(({ cover: _cover, ...rest }) => rest);
    sessionStorage.setItem(KNOWN_KEY, JSON.stringify(slim));
  } catch {
    /* penuh: cukup simpan di memori */
  }
}

/** Kosongkan cache di memori (dipakai test supaya antar skenario tidak saling memengaruhi). */
export function resetPlaceCaches() {
  nearbyCache.clear();
  known.clear();
  hydrated = false;
  preferredOverpass = 0;
  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem(STALE_KEY);
    } catch {
      /* abaikan */
    }
  }
}

export function getKnownPlace(id: string): Warung | undefined {
  hydrate();
  return known.get(id);
}

// ---------------------------------------------------------------------------
// Ingat lokasi pencarian terakhir (supaya tidak hilang saat kembali dari profil warung)
// ---------------------------------------------------------------------------

const AREA_KEY = "lokaloka-area-v1";

export function loadArea(): Area | null {
  if (typeof window === "undefined") return null;
  try {
    const a = JSON.parse(sessionStorage.getItem(AREA_KEY) ?? "null") as Area | null;
    return a && Number.isFinite(a.lat) && Number.isFinite(a.lng) && a.name ? a : null;
  } catch {
    return null;
  }
}

export function saveArea(a: Area | null) {
  if (typeof window === "undefined") return;
  try {
    if (a) sessionStorage.setItem(AREA_KEY, JSON.stringify(a));
    else sessionStorage.removeItem(AREA_KEY);
  } catch {
    /* abaikan */
  }
}
