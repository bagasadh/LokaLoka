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

export const FOOD_KEYWORDS = [
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

