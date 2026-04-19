// Normalize the "NC" column from the SF PUB LIB form to a country.
// UWC parlance: "NC" = National Committee. Usually the NC is country-specific
// (e.g. "Polish NC" = Poland), but some NCs are regional (GCC covers 6 Gulf states).
// Returns { country, flag } where flag !== null if the row needs manual review.

const DIRECT_MAP: Record<string, string> = {
  // Language-form adjectives → country
  "iranian": "Iran",
  "polish": "Poland",
  "spanish": "Spain",
  "chinese": "China",
  "nigerian": "Nigeria",

  // Informal / abbreviated
  "u.s.": "USA",
  "us": "USA",
  "usa": "USA",
  "united states": "USA",
  "uk": "United Kingdom",
  "united kingdom": "United Kingdom",

  // Renamed
  "macedonia": "North Macedonia",

  // Regional blocs (flag — not a single country)
  "gcc": "GCC",
};

export function normalizeNC(raw: string | null | undefined): {
  country: string | null;
  flag: string | null;
} {
  if (!raw) return { country: null, flag: null };

  // Strip common suffixes/prefixes before lookup.
  const cleaned = raw
    .trim()
    .toLowerCase()
    .replace(/\s+nc$/i, "")
    .replace(/^uwc\s+/i, "")
    .trim();

  if (!cleaned) return { country: null, flag: null };

  const mapped = DIRECT_MAP[cleaned];
  if (mapped === "GCC") {
    return { country: "GCC", flag: "nc_is_region_not_country" };
  }
  if (mapped) return { country: mapped, flag: null };

  // Otherwise assume the raw string is already a country name — title-case it.
  const titled = cleaned
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
  return { country: titled, flag: null };
}
