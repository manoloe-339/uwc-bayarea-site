/**
 * Tunables for the inline LinkedIn enrichment pipeline.
 * Values that used to live on the Railway service now live here so
 * every stage (search → match → scrape → transform) can be configured
 * from one place.
 */

export const ENRICHMENT_CONFIG = {
  /** Apify actor that scrapes a LinkedIn profile URL. Community-maintained. */
  APIFY_ACTOR_ID: "dev_fusion/Linkedin-Profile-Scraper",
  APIFY_RUN_TIMEOUT_SECS: 600,
  APIFY_MEMORY_MB: 1024,

  /** Claude Haiku — good enough for disambiguating LinkedIn candidates. */
  CLAUDE_MODEL: "claude-haiku-4-5-20251001",

  /** Where enriched photos get re-hosted. */
  PHOTO_STORAGE_PREFIX: "alumni-photos/",

  /** Limits to cap wild Scenario-B fan-out cost. */
  SERPER_RESULTS_PER_QUERY: 10,
  EXA_RESULTS_PER_QUERY: 10,
  MAX_CANDIDATES_TO_CLAUDE: 12,
} as const;

/**
 * UWC school name variants used to build Serper / Exa queries.
 * Deliberately omitting "USA" alone — too noisy as a bare search term.
 * Ported verbatim from scripts/discover_missing_linkedin.py.
 */
export const UWC_SHORT_FORMS: Record<string, string> = {
  "UWC Mostar": "Mostar",
  "UWC Mahindra": "Mahindra",
  "UWC Changshu China": "Changshu",
  "UWC Adriatic": "Adriatic",
  "UWC Dilijan": "Dilijan",
  "UWC Maastricht": "Maastricht",
  "UWC Robert Bosch": "Robert Bosch",
  "Red Cross Nordic": "Red Cross Nordic",
  "UWC Atlantic College": "Atlantic College",
  "Atlantic College": "Atlantic College",
  "Pearson College": "Pearson College",
  "UWC Pearson College": "Pearson College",
  "Li Po Chun": "Li Po Chun",
  "UWC Li Po Chun": "Li Po Chun",
  "Waterford Kamhlaba": "Waterford Kamhlaba",
  "UWC Costa Rica": "Costa Rica",
  "UWC ISAK Japan": "ISAK Japan",
  "UWC East Africa": "East Africa",
  "UWC South East Asia": "South East Asia",
  "UWC Thailand": "Thailand",
};

export function schoolVariants(school: string | null | undefined): string[] {
  if (!school) return [];
  const exact = UWC_SHORT_FORMS[school.trim()];
  const variants = new Set<string>();
  variants.add(school.trim());
  if (exact) variants.add(exact);
  return [...variants];
}

/**
 * Detects whether a blob of LinkedIn education text mentions a UWC.
 * Same coverage as scripts/enrich_bay_area.py UWC_PATTERN.
 */
export const UWC_PATTERN =
  /\b(uwc|united\s*world\s*college|muwci|li\s*po\s*chun|waterford|pearson\s*college|red\s*cross\s*nordic|adriatic|mahindra|atlantic\s*college|armand\s*hammer|mostar|changshu|dilijan|isak\s*japan|robert\s*bosch|maastricht|costa\s*rica|south\s*east\s*asia|davis\s*uwc)\b/i;

/** Env var accessors with clear error messages. */
export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} not set`);
  return v;
}
