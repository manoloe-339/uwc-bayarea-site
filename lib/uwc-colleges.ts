// The 19 United World Colleges (18 current + Simón Bolívar, closed 2020).
// Canonical name is what we store in the DB and show in the UI.
// Aliases are matched as whole words (lower-cased) inside the input string,
// so short acronyms like "AC" don't collide with longer words.

export type College = {
  canonical: string;
  short: string;
  country: string;
  aliases: readonly string[];
};

export const COLLEGES: readonly College[] = [
  { canonical: "UWC Atlantic",          short: "Atlantic",         country: "Wales, UK",               aliases: ["atlantic", "uwc atlantic", "atlantic college", "ac", "uwc ac", "uwcac", "awc", "uwca"] },
  { canonical: "UWC Pearson College",   short: "Pearson",          country: "Canada",                  aliases: ["pearson", "uwc pearson", "pearson college", "pcuwc", "pc uwc", "lbpuwc", "lbp", "college of the pacific", "lester b pearson"] },
  { canonical: "UWC USA",               short: "USA",              country: "USA",                     aliases: ["uwc usa", "uwc-usa", "uwcusa", "armand hammer", "new mexico", "montezuma", "usa", "american west"] },
  { canonical: "UWC Adriatic",          short: "Adriatic",         country: "Italy",                   aliases: ["adriatic", "uwc adriatic", "duino", "ad", "uwc ad", "uwcad"] },
  { canonical: "UWC Red Cross Nordic",  short: "Red Cross Nordic", country: "Norway",                  aliases: ["red cross nordic", "rcn", "uwc rcn", "rcnuwc", "nordic", "flekke"] },
  { canonical: "UWC Mahindra",          short: "Mahindra",         country: "India",                   aliases: ["mahindra", "uwc mahindra", "muwci", "pune", "uwc india", "uwc in india"] },
  { canonical: "UWC Costa Rica",        short: "Costa Rica",       country: "Costa Rica",              aliases: ["costa rica", "uwc costa rica", "uwccr", "uwc cr"] },
  { canonical: "UWC Waterford Kamhlaba", short: "Waterford",       country: "Eswatini",                aliases: ["waterford", "uwc waterford", "kamhlaba", "waterford kamhlaba", "swaziland", "eswatini"] },
  { canonical: "UWC Mostar",            short: "Mostar",           country: "Bosnia and Herzegovina",  aliases: ["mostar", "uwc mostar", "uwcim", "bosnia"] },
  { canonical: "UWC Li Po Chun",        short: "Li Po Chun",       country: "Hong Kong",               aliases: ["li po chun", "uwc li po chun", "lpc", "lpcuwc", "hong kong"] },
  { canonical: "UWC Robert Bosch",      short: "Robert Bosch",     country: "Germany",                 aliases: ["robert bosch", "uwc robert bosch", "rbc", "uwc rbc", "uwcrbc", "freiburg"] },
  { canonical: "UWC Dilijan",           short: "Dilijan",          country: "Armenia",                 aliases: ["dilijan", "uwc dilijan", "armenia"] },
  { canonical: "UWC Maastricht",        short: "Maastricht",       country: "Netherlands",             aliases: ["maastricht", "uwc maastricht", "uwcm", "uwcmaastricht", "netherlands"] },
  { canonical: "UWC Changshu China",    short: "Changshu",         country: "China",                   aliases: ["changshu", "uwc changshu", "uwc china"] },
  { canonical: "UWC Thailand",          short: "Thailand",         country: "Thailand",                aliases: ["uwc thailand", "uwct", "phuket"] },
  { canonical: "UWC ISAK Japan",        short: "ISAK Japan",       country: "Japan",                   aliases: ["isak", "uwc isak", "uwc japan", "karuizawa"] },
  { canonical: "UWC South East Asia",   short: "UWCSEA",           country: "Singapore",               aliases: ["south east asia", "uwcsea", "uwc sea", "uwc south east asia", "sea", "dover", "east campus", "southeast asia", "uwc singapore", "singapore"] },
  { canonical: "UWC East Africa",       short: "East Africa",      country: "Tanzania",                aliases: ["east africa", "uwc east africa", "uwcea", "tanzania", "moshi", "arusha"] },
  { canonical: "UWC Simón Bolívar",     short: "Simón Bolívar",    country: "Venezuela (closed)",      aliases: ["simon bolivar", "simón bolívar", "uwc simon bolivar", "venezuela", "uwc venezuela"] },
];

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
