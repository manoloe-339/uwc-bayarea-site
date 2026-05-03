// The 19 United World Colleges (18 current + Simón Bolívar, closed 2012).
// Canonical name is what we store in the DB and show in the UI.
// Aliases are matched as whole words (lower-cased) inside the input string,
// so short acronyms like "AC" don't collide with longer words.

export type College = {
  canonical: string;
  short: string;
  country: string;
  aliases: readonly string[];
  /** First year alumni could have graduated (or attended) under the UWC banner. */
  firstYear: number;
  /** Last graduation year for closed schools. Omit for currently-operating ones. */
  lastYear?: number;
};

export const COLLEGES: readonly College[] = [
  { canonical: "UWC Atlantic College",  short: "Atlantic",         country: "Wales, UK",               firstYear: 1962, aliases: ["atlantic", "uwc atlantic", "uwc atlantic college", "atlantic college", "ac", "uwc ac", "uwcac", "awc", "uwca"] },
  { canonical: "UWC Pearson College",   short: "Pearson",          country: "Canada",                  firstYear: 1974, aliases: ["pearson", "uwc pearson", "pearson college", "pcuwc", "pc uwc", "lbpuwc", "lbp", "college of the pacific", "lester b pearson"] },
  { canonical: "UWC USA",               short: "USA",              country: "USA",                     firstYear: 1982, aliases: ["uwc usa", "uwc-usa", "uwcusa", "armand hammer", "new mexico", "montezuma", "usa", "american west"] },
  { canonical: "UWC Adriatic",          short: "Adriatic",         country: "Italy",                   firstYear: 1982, aliases: ["adriatic", "uwc adriatic", "duino", "ad", "uwc ad", "uwcad"] },
  { canonical: "UWC Red Cross Nordic",  short: "Red Cross Nordic", country: "Norway",                  firstYear: 1995, aliases: ["red cross nordic", "rcn", "uwc rcn", "rcnuwc", "nordic", "flekke"] },
  { canonical: "UWC Mahindra",          short: "Mahindra",         country: "India",                   firstYear: 1997, aliases: ["mahindra", "uwc mahindra", "muwci", "pune", "uwc india", "uwc in india"] },
  { canonical: "UWC Costa Rica",        short: "Costa Rica",       country: "Costa Rica",              firstYear: 2006, aliases: ["costa rica", "uwc costa rica", "uwccr", "uwc cr"] },
  { canonical: "UWC Waterford Kamhlaba", short: "Waterford",       country: "Eswatini",                firstYear: 1963, aliases: ["waterford", "uwc waterford", "kamhlaba", "waterford kamhlaba", "swaziland", "eswatini"] },
  { canonical: "UWC Mostar",            short: "Mostar",           country: "Bosnia and Herzegovina",  firstYear: 2006, aliases: ["mostar", "uwc mostar", "uwcim", "bosnia"] },
  { canonical: "UWC Li Po Chun",        short: "Li Po Chun",       country: "Hong Kong",               firstYear: 1992, aliases: ["li po chun", "uwc li po chun", "lpc", "lpcuwc", "hong kong"] },
  { canonical: "UWC Robert Bosch College", short: "Robert Bosch",  country: "Germany",                 firstYear: 2014, aliases: ["robert bosch", "uwc robert bosch", "uwc robert bosch college", "rbc", "uwc rbc", "uwcrbc", "freiburg"] },
  { canonical: "UWC Dilijan",           short: "Dilijan",          country: "Armenia",                 firstYear: 2014, aliases: ["dilijan", "uwc dilijan", "armenia"] },
  { canonical: "UWC Maastricht",        short: "Maastricht",       country: "Netherlands",             firstYear: 2009, aliases: ["maastricht", "uwc maastricht", "uwcm", "uwcmaastricht", "netherlands"] },
  { canonical: "UWC Changshu China",    short: "Changshu",         country: "China",                   firstYear: 2015, aliases: ["changshu", "uwc changshu", "uwc china"] },
  { canonical: "UWC Thailand",          short: "Thailand",         country: "Thailand",                firstYear: 2016, aliases: ["uwc thailand", "uwct", "phuket"] },
  { canonical: "UWC ISAK Japan",        short: "ISAK Japan",       country: "Japan",                   firstYear: 2014, aliases: ["isak", "uwc isak", "uwc japan", "karuizawa"] },
  { canonical: "UWC South East Asia",   short: "UWCSEA",           country: "Singapore",               firstYear: 1971, aliases: ["south east asia", "uwcsea", "uwc sea", "uwc south east asia", "sea", "dover", "east campus", "southeast asia", "uwc singapore", "singapore"] },
  { canonical: "UWC East Africa",       short: "East Africa",      country: "Tanzania",                firstYear: 2019, aliases: ["east africa", "uwc east africa", "uwcea", "tanzania", "moshi", "arusha"] },
  { canonical: "UWC Simón Bolívar",     short: "Simón Bolívar",    country: "Venezuela (closed)",      firstYear: 1988, lastYear: 2012, aliases: ["simon bolivar", "simón bolívar", "uwc simon bolivar", "venezuela", "uwc venezuela"] },
];

/**
 * Returns the inclusive [min, max] year range a graduate of `canonical`
 * could have attended. For currently-operating schools, max is current
 * year + 2 (covers students still enrolled). For closed schools, max is
 * the school's last year of operation.
 */
export function gradYearRangeFor(canonical: string | null | undefined): { min: number; max: number } | null {
  if (!canonical) return null;
  const c = COLLEGES.find((x) => x.canonical === canonical);
  if (!c) return null;
  const max = c.lastYear ?? new Date().getFullYear() + 2;
  return { min: c.firstYear, max };
}

type IndexedAlias = { pattern: RegExp; college: College };

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildIndex(): IndexedAlias[] {
  const seen = new Set<string>();
  const entries: IndexedAlias[] = [];
  for (const c of COLLEGES) {
    const aliases = [c.canonical, c.short, ...c.aliases];
    for (const alias of aliases) {
      const key = alias.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      entries.push({
        pattern: new RegExp(`(^|[^a-z0-9])${escape(key)}([^a-z0-9]|$)`, "i"),
        college: c,
      });
    }
  }
  // Longer aliases first (fewer false positives).
  return entries.sort((a, b) => b.pattern.source.length - a.pattern.source.length);
}

const ALIAS_INDEX = buildIndex();

export function normalizeCollege(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim().toLowerCase();
  if (!s) return null;
  for (const { pattern, college } of ALIAS_INDEX) {
    if (pattern.test(s)) return college.canonical;
  }
  return null;
}

export function findCollege(canonical: string): College | undefined {
  return COLLEGES.find((c) => c.canonical === canonical);
}

export function isPearson(canonical: string | null | undefined): boolean {
  return canonical === "UWC Pearson College";
}
