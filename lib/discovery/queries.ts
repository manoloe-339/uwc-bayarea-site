/**
 * Search-query templates used by /admin/tools/discover.
 *
 * Source of truth at runtime is the `discovery_query_templates` table
 * (admin-editable on /admin/tools/discover/settings). The constant
 * below is the seed data + a hardcoded fallback used if the table is
 * empty for any reason.
 */

import { sql } from "@/lib/db";

export const DISCOVERY_QUERIES: { q: string; group: string }[] = [
  // A. Broad UWC + Bay Area phrasing
  { q: `"UWC" "San Francisco Bay Area" site:linkedin.com/in/`, group: "uwc-broad" },
  { q: `"UWC" "Bay Area" site:linkedin.com/in/`, group: "uwc-broad" },
  { q: `"UWC" "San Francisco" site:linkedin.com/in/`, group: "uwc-broad" },
  { q: `"UWC" California site:linkedin.com/in/`, group: "uwc-broad" },

  // B. "United World College" singular
  { q: `"United World College" "Bay Area" site:linkedin.com/in/`, group: "united-world-college" },
  { q: `"United World College" "San Francisco" site:linkedin.com/in/`, group: "united-world-college" },

  // C. Davis Scholar
  { q: `"Davis Scholar" "San Francisco" site:linkedin.com/in/`, group: "davis-scholar" },
  { q: `"Davis Scholar" "Bay Area" site:linkedin.com/in/`, group: "davis-scholar" },

  // D. UWC + specific Bay Area cities + sub-regions
  { q: `"UWC" Berkeley site:linkedin.com/in/`, group: "uwc-city" },
  { q: `"UWC" "Palo Alto" site:linkedin.com/in/`, group: "uwc-city" },
  { q: `"UWC" "San Jose" site:linkedin.com/in/`, group: "uwc-city" },
  { q: `"UWC" Oakland site:linkedin.com/in/`, group: "uwc-city" },
  { q: `"UWC" "Mountain View" site:linkedin.com/in/`, group: "uwc-city" },
  { q: `"UWC" "Marin" site:linkedin.com/in/`, group: "uwc-city" },
  { q: `"UWC" "South Bay" site:linkedin.com/in/`, group: "uwc-region" },
  { q: `"UWC" "East Bay" site:linkedin.com/in/`, group: "uwc-region" },
  { q: `"UWC" "Peninsula" site:linkedin.com/in/`, group: "uwc-region" },

  // E. Bare college names (people who don't write "UWC")
  { q: `"Atlantic College" "Bay Area" site:linkedin.com/in/`, group: "bare-college" },
  { q: `"Pearson College" "San Francisco" site:linkedin.com/in/`, group: "bare-college" },
  { q: `"Li Po Chun" "Bay Area" site:linkedin.com/in/`, group: "bare-college" },
  { q: `"Waterford Kamhlaba" "Bay Area" site:linkedin.com/in/`, group: "bare-college" },
  { q: `"UWCSEA" "Bay Area" site:linkedin.com/in/`, group: "bare-college" },
  { q: `"UWC USA" "Bay Area" site:linkedin.com/in/`, group: "bare-college" },
  { q: `"UWC Adriatic" "Bay Area" site:linkedin.com/in/`, group: "bare-college" },
  { q: `"UWC Costa Rica" "Bay Area" site:linkedin.com/in/`, group: "bare-college" },
  { q: `"UWC Red Cross Nordic" "San Francisco" site:linkedin.com/in/`, group: "bare-college" },
];

type DBQueryRow = { query: string; group_label: string | null };

/**
 * Load enabled queries from the DB. Falls back to DISCOVERY_QUERIES if
 * the table returns nothing (defensive against an accidentally-emptied
 * table breaking discovery).
 */
export async function loadActiveQueries(): Promise<{ q: string; group: string }[]> {
  const rows = (await sql`
    SELECT query, group_label
    FROM discovery_query_templates
    WHERE enabled = TRUE
    ORDER BY sort_order ASC, id ASC
  `) as DBQueryRow[];
  if (rows.length === 0) return DISCOVERY_QUERIES;
  return rows.map((r) => ({ q: r.query, group: r.group_label ?? "" }));
}

/** Load excluded-term strings from DB. Each is matched case-insensitively
 *  against the title + snippet of every search hit before triage. */
export async function loadExcludedTerms(): Promise<string[]> {
  const rows = (await sql`
    SELECT term FROM discovery_excluded_terms ORDER BY term ASC
  `) as { term: string }[];
  if (rows.length === 0) return ["Western Cape"];
  return rows.map((r) => r.term);
}

const LINKEDIN_PROFILE_URL_RE = /^https?:\/\/(?:[a-z0-9]+\.)?linkedin\.com\/in\/[^/?#]+/i;

/**
 * Normalize a LinkedIn URL to a canonical form so dedup works:
 *   https://www.linkedin.com/in/<slug>
 * Drops protocol-www variations, regional subdomains, trailing slash,
 * query, fragment.
 */
export function normalizeLinkedinUrl(raw: string): string | null {
  const cleaned = raw.trim().split("?", 1)[0].split("#", 1)[0].replace(/\/+$/, "");
  if (!LINKEDIN_PROFILE_URL_RE.test(cleaned)) return null;
  try {
    const u = new URL(cleaned);
    const path = u.pathname.replace(/\/+$/, "");
    const slugMatch = path.match(/\/in\/([^/]+)/i);
    if (!slugMatch) return null;
    return `https://www.linkedin.com/in/${slugMatch[1].toLowerCase()}`;
  } catch {
    return null;
  }
}

/**
 * Best-effort name extraction from a LinkedIn search hit's title.
 * Titles look like: "Lale Quezada - Software Engineer at Stripe | LinkedIn"
 * or "Jane Doe - LinkedIn".
 */
export function guessNameFromTitle(title: string): string | null {
  if (!title) return null;
  // Strip trailing " | LinkedIn" or " - LinkedIn"
  const stripped = title
    .replace(/\s*[-|·]\s*LinkedIn\s*$/i, "")
    .replace(/\s*\|\s*LinkedIn\s*$/i, "")
    .trim();
  // Take everything before the first " - " or " — " or " | " (job title separators).
  const m = stripped.match(/^(.+?)\s+[-—|]\s+/);
  const candidate = (m ? m[1] : stripped).trim();
  // Sanity: should be 2-5 words, mostly letters / hyphens / apostrophes.
  if (candidate.length < 2 || candidate.length > 80) return null;
  if (!/^[\p{L}][\p{L}\s'\-.]+$/u.test(candidate)) return null;
  return candidate;
}
