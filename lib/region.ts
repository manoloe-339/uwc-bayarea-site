// Classify a free-text "current city" string into a Bay Area region.
// Longest alias wins (so "south san francisco" beats "san francisco").
// Strings that match no Bay Area / NorCal alias → "Outside NorCal".
// Empty or null → null (unknown).

export const REGIONS = [
  "San Francisco",
  "East Bay",
  "North Bay",
  "Peninsula / South Bay",
  "Northern CA (other)",
  "Outside NorCal",
] as const;

export type Region = (typeof REGIONS)[number];

const REGION_ALIASES: ReadonlyArray<{ region: Region; alias: string }> = (() => {
  const map: Record<Region, string[]> = {
    "San Francisco": ["san francisco", "san fransisco", "s.f.", "sf", "soma"],
    "East Bay": [
      "berkeley", "oakland", "emeryville", "alameda", "richmond", "albany",
      "el cerrito", "hayward", "fremont", "castro valley", "san leandro",
      "union city", "walnut creek", "concord", "lafayette", "orinda", "moraga",
      "danville", "san ramon", "pleasanton", "dublin", "livermore", "martinez",
      "pinole", "pittsburg", "antioch", "brentwood", "piedmont",
    ],
    "North Bay": [
      "sausalito", "tiburon", "mill valley", "larkspur", "corte madera",
      "kentfield", "san anselmo", "fairfax", "san rafael", "novato",
      "petaluma", "rohnert park", "santa rosa", "sonoma", "napa", "vallejo",
      "american canyon", "calistoga", "st. helena", "st helena", "yountville",
      "benicia",
    ],
    "Peninsula / South Bay": [
      "south san francisco", "palo alto", "menlo park", "atherton", "stanford",
      "portola valley", "woodside", "mountain view", "los altos", "sunnyvale",
      "santa clara", "cupertino", "saratoga", "los gatos", "campbell",
      "san jose", "milpitas", "morgan hill", "gilroy", "redwood city",
      "san carlos", "belmont", "san mateo", "foster city", "burlingame",
      "millbrae", "san bruno", "ssf", "daly city", "pacifica", "hillsborough",
      "half moon bay", "brisbane",
    ],
    "Northern CA (other)": [
      "santa cruz", "capitola", "scotts valley", "monterey", "carmel",
      "pacific grove", "davis", "sacramento", "west sacramento", "roseville",
      "rocklin", "folsom", "elk grove", "stockton", "modesto", "tracy",
      "eureka", "arcata", "ukiah", "mendocino", "lake tahoe", "truckee",
      "south lake tahoe", "bay area", "ione", "fresno", "merced",
    ],
    "Outside NorCal": [], // implicit default
  };
  const entries: { region: Region; alias: string }[] = [];
  for (const r of REGIONS) {
    for (const a of map[r]) entries.push({ region: r, alias: a });
  }
  return entries.sort((a, b) => b.alias.length - a.alias.length);
})();

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const REGION_PATTERNS: ReadonlyArray<{ region: Region; pattern: RegExp }> =
  REGION_ALIASES.map(({ region, alias }) => ({
    region,
    // Word boundaries around the alias so "sf" doesn't match inside "sfs" etc.
    pattern: new RegExp(`(^|[^a-z0-9])${escape(alias)}([^a-z0-9]|$)`, "i"),
  }));

export function cityToRegion(raw: string | null | undefined): Region | null {
  if (!raw) return null;
  const s = raw.toLowerCase().trim();
  if (!s) return null;
  for (const { region, pattern } of REGION_PATTERNS) {
    if (pattern.test(s)) return region;
  }
  return "Outside NorCal";
}
