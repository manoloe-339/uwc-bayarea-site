/**
 * Display-time city normalization.
 *
 * Folds messy free-text city values ("SF", "San Francisco", "San
 * francisco", "(soon!) San Francisco", "Berkeley, CA") into a single
 * canonical display form for snapshot views. **Does not modify the
 * underlying DB** — the raw current_city stays as the user entered
 * it, the search filter still passes the raw value through ILIKE, and
 * existing card rendering / filters are unaffected.
 *
 * Use only when grouping cities for display (snapshot lists, charts).
 */

/** Aliases for cities that show up as nicknames or abbreviations in
 * the DB. Keyed by lowercase form, value is the canonical display
 * name we want to render. */
const ALIASES: Record<string, string> = {
  "sf": "San Francisco",
  "san fran": "San Francisco",
  "san francisco": "San Francisco",
  "nyc": "New York",
  "ny": "New York",
  "new york": "New York",
  "new york city": "New York",
  "manhattan": "New York",
  "brooklyn": "New York",
  "la": "Los Angeles",
  "los angeles": "Los Angeles",
  "dc": "Washington DC",
  "washington dc": "Washington DC",
  "washington d.c.": "Washington DC",
  "washington, d.c.": "Washington DC",
  "boston": "Boston",
  "cambridge": "Cambridge", // MA — left distinct
  "chicago": "Chicago",
  "seattle": "Seattle",
  "austin": "Austin",
  "portland": "Portland",
  "denver": "Denver",
  "miami": "Miami",
  "philadelphia": "Philadelphia",
  "atlanta": "Atlanta",
  "san diego": "San Diego",
  "san jose": "San Jose",
  "palo alto": "Palo Alto",
  "stanford": "Stanford",
  "berkeley": "Berkeley",
  "oakland": "Oakland",
  "santa clara": "Santa Clara",
  "sunnyvale": "Sunnyvale",
  "menlo park": "Menlo Park",
  "mountain view": "Mountain View",
  "redwood city": "Redwood City",
  "san mateo": "San Mateo",
  "fremont": "Fremont",
  "santa cruz": "Santa Cruz",
  "london": "London",
  "paris": "Paris",
  "berlin": "Berlin",
  "amsterdam": "Amsterdam",
  "singapore": "Singapore",
  "hong kong": "Hong Kong",
  "tokyo": "Tokyo",
  "shanghai": "Shanghai",
  "beijing": "Beijing",
  "bangalore": "Bangalore",
  "bengaluru": "Bangalore",
  "mumbai": "Mumbai",
  "delhi": "Delhi",
  "new delhi": "Delhi",
  "toronto": "Toronto",
  "vancouver": "Vancouver",
  "montreal": "Montreal",
  "sydney": "Sydney",
  "melbourne": "Melbourne",
  "dubai": "Dubai",
  "tel aviv": "Tel Aviv",
  "brisbane": "Brisbane",
};

const TRAILING_QUAL = new RegExp(
  "[,\\s]+(?:" +
    [
      // US states (abbrev + full)
      "ca", "california", "ny", "new york state", "tx", "texas",
      "wa", "washington state", "or", "oregon", "fl", "florida",
      "il", "illinois", "ma", "massachusetts", "co", "colorado",
      "ga", "georgia", "az", "arizona", "nc", "north carolina",
      "sc", "south carolina", "nm", "new mexico", "mi", "michigan",
      "oh", "ohio", "pa", "pennsylvania", "nj", "new jersey",
      "va", "virginia", "md", "maryland", "mn", "minnesota",
      "wi", "wisconsin", "ut", "utah", "ct", "connecticut",
      // Country suffixes
      "usa", "us", "u\\.s\\.", "u\\.s\\.a\\.", "united states",
      "uk", "u\\.k\\.", "united kingdom", "england",
      "canada", "australia", "india", "china",
      "germany", "france", "spain", "italy", "netherlands",
      "switzerland", "sweden", "norway", "denmark",
    ].join("|") +
    ")\\s*$",
  "i",
);

/** Returns null if the input doesn't look like a city at all. */
export function normalizeCity(raw: string | null | undefined): {
  /** Canonical lower-case key — use for grouping. */
  key: string;
  /** Canonical display form — Title-Case. */
  display: string;
} | null {
  if (!raw) return null;
  let s = raw.trim();
  if (!s) return null;
  // Drop parentheticals like "(soon!)" or "(SF Bay Area)"
  s = s.replace(/\([^)]*\)/g, " ").trim();
  // Strip trailing ", CA" / ", California" / ", USA" etc — repeat in case
  // we have nested suffixes like "Berkeley, CA, USA".
  for (let i = 0; i < 3; i++) {
    const next = s.replace(TRAILING_QUAL, "").trim();
    if (next === s) break;
    s = next;
  }
  // Collapse whitespace + lowercase for lookup
  const lower = s.replace(/\s+/g, " ").toLowerCase();
  if (!lower) return null;

  const aliased = ALIASES[lower];
  if (aliased) return { key: aliased.toLowerCase(), display: aliased };

  // Title-case fallback for whatever's left.
  const display = lower
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
  return { key: lower, display };
}
