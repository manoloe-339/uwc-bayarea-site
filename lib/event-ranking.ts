import type { AlumniRow } from "./alumni-query";
import { sql } from "./db";

export type ScoringOptions = {
  rankByEngagement: boolean;
  rankByDiversity: boolean;
  rankByRecency: boolean;
};

export type EngagementStats = {
  sent: number;
  opened: number;
};

export type ScoredAlum = AlumniRow & {
  score: number;
  reasons: string[];
};

/**
 * Fetch per-alum email engagement for a batch of alumni in one query.
 * Returns a Map keyed by alumni_id; missing entries mean "no sends on record".
 */
export async function loadEngagement(
  alumniIds: number[]
): Promise<Map<number, EngagementStats>> {
  const out = new Map<number, EngagementStats>();
  if (alumniIds.length === 0) return out;
  const rows = (await sql`
    SELECT alumni_id,
           COUNT(*) FILTER (WHERE status = 'sent')::int        AS sent,
           COUNT(*) FILTER (WHERE opened_at IS NOT NULL)::int  AS opened
    FROM email_sends
    WHERE alumni_id = ANY(${alumniIds})
    GROUP BY alumni_id
  `) as { alumni_id: number; sent: number; opened: number }[];
  for (const r of rows) out.set(r.alumni_id, { sent: r.sent, opened: r.opened });
  return out;
}

function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return (Date.now() - t) / (1000 * 60 * 60 * 24);
}

function seniorityDescriptor(gradYear: number | null | undefined): string | null {
  if (!gradYear) return null;
  if (gradYear < 2010) return "Senior alum perspective";
  if (gradYear <= 2018) return "Mid-career voice";
  return "Recent grad perspective";
}

/**
 * Pack a priority-ordered list of short phrases into a concise reason list,
 * capped at maxCount items and maxChars total (counting ", " separators).
 */
function packReasons(candidates: string[], maxChars: number, maxCount: number): string[] {
  const out: string[] = [];
  let len = 0;
  for (const c of candidates) {
    if (out.length >= maxCount) break;
    const add = out.length > 0 ? c.length + 2 : c.length;
    if (len + add > maxChars) break;
    out.push(c);
    len += add;
  }
  return out;
}

function norm(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

/**
 * Score and rank a candidate pool for event planning, generating a concise
 * "why they fit" rationale for each. Reasons focus on what this person ADDS
 * to the pool (diversity, engagement, recency) plus a seniority descriptor
 * — they do not duplicate the visible Name / Role columns.
 */
export function scoreAlumni(
  rows: AlumniRow[],
  opts: ScoringOptions,
  engagement: Map<number, EngagementStats>
): ScoredAlum[] {
  // Pass 1: base scores (scoring concern only, no reasons yet)
  const scored: ScoredAlum[] = rows.map((r) => {
    let score = 50;

    if (r.photo_url) score += 5;
    if (r.headline) score += 5;

    if (opts.rankByRecency) {
      const days = daysSince(r.enriched_at);
      if (days != null) {
        if (days <= 30) score += 10;
        else if (days <= 90) score += 5;
        else if (days >= 180) score -= 5;
      }
    }

    if (opts.rankByEngagement) {
      const e = engagement.get(r.id);
      if (e && e.sent > 0) {
        if (e.opened >= 5) score += 35;
        else if (e.opened >= 3) score += 25;
        else if (e.opened === 2) score += 15;
        else if (e.opened === 1) score += 5;
        else score -= 10;
      }
    }

    return { ...r, score, reasons: [] };
  });

  // Pass 2: initial sort by score
  const byScoreDesc = (a: ScoredAlum, b: ScoredAlum) => {
    if (b.score !== a.score) return b.score - a.score;
    const la = (a.last_name ?? "").toLowerCase();
    const lb = (b.last_name ?? "").toLowerCase();
    return la.localeCompare(lb);
  };
  scored.sort(byScoreDesc);

  // Pass 3: diversity penalty (score-only, if enabled) — uses current order
  if (opts.rankByDiversity) {
    const seen = new Map<string, number>();
    for (const s of scored) {
      const key = norm(s.current_company);
      if (!key) continue;
      const n = seen.get(key) ?? 0;
      if (n === 1) s.score -= 10;
      else if (n === 2) s.score -= 20;
      else if (n >= 3) s.score -= 30;
      seen.set(key, n + 1);
    }
    scored.sort(byScoreDesc);
  }

  // Pass 4: compute reasons based on final sort order
  const seenOrigin = new Map<string, number>();
  const seenRegion = new Map<string, number>();
  const seenSchool = new Map<string, number>();
  const seenCompany = new Map<string, number>();

  for (const s of scored) {
    const diversity: string[] = [];

    const origin = (s.origin ?? "").trim();
    if (origin) {
      const n = seenOrigin.get(norm(origin)) ?? 0;
      if (n === 0) diversity.push(`Adds ${origin} diversity`);
      seenOrigin.set(norm(origin), n + 1);
    }

    const region = (s.region ?? "").trim();
    if (region) {
      const n = seenRegion.get(norm(region)) ?? 0;
      if (n === 0) diversity.push(`${region} representation`);
      seenRegion.set(norm(region), n + 1);
    }

    const school = (s.uwc_college ?? "").trim();
    if (school) {
      const n = seenSchool.get(norm(school)) ?? 0;
      if (n === 0) diversity.push("Different UWC background");
      seenSchool.set(norm(school), n + 1);
    }

    const company = (s.current_company ?? "").trim();
    if (company) {
      const n = seenCompany.get(norm(company)) ?? 0;
      if (n === 0) diversity.push("Unique company background");
      seenCompany.set(norm(company), n + 1);
    }

    // Engagement phrase (positive only — never negative in reasons)
    let engagementReason: string | null = null;
    if (opts.rankByEngagement) {
      const e = engagement.get(s.id);
      if (e && e.sent > 0) {
        if (e.opened >= 5) engagementReason = "High engagement";
        else if (e.opened >= 3) engagementReason = "Opens emails";
        else if (e.opened >= 1) engagementReason = "Active profile";
      }
    }

    // Recency phrase
    let recencyReason: string | null = null;
    if (opts.rankByRecency) {
      const days = daysSince(s.enriched_at);
      if (days != null) {
        if (days <= 30) recencyReason = "Recently updated";
        else if (days <= 90) recencyReason = "Current profile";
      }
    }

    const seniority = seniorityDescriptor(s.grad_year);

    // Priority: diversity additions > engagement > recency > seniority
    const candidates = [
      ...diversity,
      engagementReason,
      recencyReason,
      seniority,
    ].filter((v): v is string => !!v);

    s.reasons = packReasons(candidates, 60, 3);
    // Fallback: every row gets at least the seniority descriptor
    if (s.reasons.length === 0 && seniority) {
      s.reasons = [seniority];
    }
  }

  return scored;
}

/**
 * Split a scored list into a top-N primary slice and up to 10 honorable
 * mentions (within 10 points of the cutoff score).
 */
export function splitEventResults(
  scored: ScoredAlum[],
  eventSize: number
): { top: ScoredAlum[]; honorable: ScoredAlum[] } {
  const n = Math.max(1, Math.min(eventSize, scored.length));
  const top = scored.slice(0, n);
  const rest = scored.slice(n);
  if (rest.length === 0 || top.length === 0) return { top, honorable: [] };
  const cutoff = top[top.length - 1].score;
  const honorable = rest.filter((s) => cutoff - s.score <= 10).slice(0, 10);
  return { top, honorable };
}
