import type { AlumniRow } from "./alumni-query";
import { sql } from "./db";

export type DiversityDimension = "origin" | "school" | "region" | "company" | "age";

export type ScoringOptions = {
  rankByEngagement: boolean;
  rankByRecency: boolean;
  /** Empty array = no diversity bonuses. */
  diversityDimensions: DiversityDimension[];
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

function ageBucket(gradYear: number | null | undefined): string | null {
  if (!gradYear) return null;
  if (gradYear >= 2020) return "2020+";
  if (gradYear >= 2015) return "2015-2019";
  if (gradYear >= 2010) return "2010-2014";
  if (gradYear >= 2005) return "2005-2009";
  if (gradYear >= 2000) return "2000-2004";
  return "<2000";
}

/** Phase 3 diversity bonus schedule: progressive bonus → penalty. */
function diversityPoints(count: number): number {
  if (count === 0) return 15;
  if (count === 1) return 5;
  if (count === 2) return 0;
  if (count === 3) return -10;
  return -20;
}

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
 * Score + rank candidates for event planning. Iterative diversity pass:
 * running counts per dimension, bonuses/penalties per dimension, re-sort
 * at end, reasons generated from final order.
 */
export function scoreAlumni(
  rows: AlumniRow[],
  opts: ScoringOptions,
  engagement: Map<number, EngagementStats>
): ScoredAlum[] {
  // Pass 1: base scores (profile completeness, engagement, recency).
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

  // Pass 2: initial sort.
  const byScoreDesc = (a: ScoredAlum, b: ScoredAlum) => {
    if (b.score !== a.score) return b.score - a.score;
    const la = (a.last_name ?? "").toLowerCase();
    const lb = (b.last_name ?? "").toLowerCase();
    return la.localeCompare(lb);
  };
  scored.sort(byScoreDesc);

  // Pass 3: iterative diversity bonus. Running counts per dimension. Bonuses
  // adjust score; reasons captured for first-occurrence only. Then re-sort.
  const dimsEnabled = new Set(opts.diversityDimensions);
  const hasAnyDiversity = dimsEnabled.size > 0;

  const counts = {
    origin: new Map<string, number>(),
    school: new Map<string, number>(),
    region: new Map<string, number>(),
    company: new Map<string, number>(),
    age: new Map<string, number>(),
  };
  const firstOccurrenceReasons = new Map<number, string[]>();

  for (const s of scored) {
    const diversityReasons: string[] = [];

    const checkDim = (
      dim: DiversityDimension,
      key: string | null,
      reasonIfFirst: () => string | null
    ) => {
      if (!dimsEnabled.has(dim)) return;
      if (!key) return;
      const map = counts[dim];
      const n = map.get(key) ?? 0;
      s.score += diversityPoints(n);
      if (n === 0) {
        const r = reasonIfFirst();
        if (r) diversityReasons.push(r);
      }
      map.set(key, n + 1);
    };

    const origin = (s.origin ?? "").trim();
    checkDim("origin", norm(origin) || null, () => (origin ? `Adds ${origin} diversity` : null));

    const school = (s.uwc_college ?? "").trim();
    checkDim("school", norm(school) || null, () => (school ? "Different UWC background" : null));

    const region = (s.region ?? "").trim();
    checkDim("region", norm(region) || null, () => (region ? `${region} representation` : null));

    const company = (s.current_company ?? "").trim();
    checkDim("company", norm(company) || null, () => (company ? "Unique company background" : null));

    // Age diversity: contribute to score but don't add a separate reason
    // (the seniority descriptor already covers age context).
    const bucket = ageBucket(s.grad_year);
    if (dimsEnabled.has("age") && bucket) {
      const n = counts.age.get(bucket) ?? 0;
      s.score += diversityPoints(n);
      counts.age.set(bucket, n + 1);
    }

    if (diversityReasons.length > 0) {
      firstOccurrenceReasons.set(s.id, diversityReasons);
    }
  }

  if (hasAnyDiversity) scored.sort(byScoreDesc);

  // Pass 4: reasons generation (uses cached first-occurrence phrases even if
  // order shifted after re-sort — the labels are still semantically correct).
  for (const s of scored) {
    const diversity = firstOccurrenceReasons.get(s.id) ?? [];

    let engagementReason: string | null = null;
    if (opts.rankByEngagement) {
      const e = engagement.get(s.id);
      if (e && e.sent > 0) {
        if (e.opened >= 5) engagementReason = "High engagement";
        else if (e.opened >= 3) engagementReason = "Opens emails";
        else if (e.opened >= 1) engagementReason = "Active profile";
      }
    }

    let recencyReason: string | null = null;
    if (opts.rankByRecency) {
      const days = daysSince(s.enriched_at);
      if (days != null) {
        if (days <= 30) recencyReason = "Recently updated";
        else if (days <= 90) recencyReason = "Current profile";
      }
    }

    const seniority = seniorityDescriptor(s.grad_year);

    const candidates = [
      ...diversity,
      engagementReason,
      recencyReason,
      seniority,
    ].filter((v): v is string => !!v);

    s.reasons = packReasons(candidates, 60, 3);
    if (s.reasons.length === 0 && seniority) s.reasons = [seniority];
  }

  return scored;
}

/**
 * Display-friendly score. Clamps negative to 0, scores ≥100 show as 100%.
 */
export function scoreAsPercent(score: number): string {
  if (score < 0) return "0%";
  if (score >= 100) return "100%";
  return `${Math.round(score)}%`;
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
