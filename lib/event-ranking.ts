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

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return (Date.now() - t) / (1000 * 60 * 60 * 24);
}

/**
 * Compute a composite 0–100-ish score and a short "why they fit" rationale
 * for each alumnus. The scoring is deliberately coarse — enough to order
 * plausible candidates meaningfully, not a precise ranking system.
 */
export function scoreAlumni(
  rows: AlumniRow[],
  opts: ScoringOptions,
  engagement: Map<number, EngagementStats>
): ScoredAlum[] {
  const scored: ScoredAlum[] = rows.map((r) => {
    let score = 50; // baseline for matching the filters
    const reasons: string[] = [];

    // Profile completeness
    if (r.photo_url) score += 5;
    if (r.headline) score += 5;

    // Recent enrichment (only if the user asked for it)
    if (opts.rankByRecency) {
      const days = daysSince(r.enriched_at ?? null);
      if (days != null) {
        if (days <= 30) {
          score += 10;
          reasons.push("Profile updated this month");
        } else if (days <= 90) {
          score += 5;
          reasons.push("Profile updated recently");
        } else if (days >= 180) {
          score -= 5;
          reasons.push("Profile may be stale");
        }
      }
    }

    // Email engagement
    if (opts.rankByEngagement) {
      const e = engagement.get(r.id);
      if (e && e.sent > 0) {
        if (e.opened >= 5) {
          score += 35;
          reasons.push(`Opened ${e.opened} of ${e.sent} emails`);
        } else if (e.opened >= 3) {
          score += 25;
          reasons.push(`Opened ${e.opened} of ${e.sent} emails`);
        } else if (e.opened === 2) {
          score += 15;
          reasons.push(`Opened 2 of ${e.sent} emails`);
        } else if (e.opened === 1) {
          score += 5;
          reasons.push(`Opened 1 of ${e.sent} emails`);
        } else {
          score -= 10;
          reasons.push(`Hasn't opened ${e.sent} prior email${e.sent === 1 ? "" : "s"}`);
        }
      }
    }

    // Surface role info whenever we have it — useful standalone context
    if (r.current_title && r.current_company) {
      reasons.unshift(`${r.current_title} @ ${r.current_company}`);
    } else if (r.current_company) {
      reasons.unshift(`At ${r.current_company}`);
    }

    return { ...r, score, reasons };
  });

  // Initial sort by score desc, then by name
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const la = (a.last_name ?? "").toLowerCase();
    const lb = (b.last_name ?? "").toLowerCase();
    return la.localeCompare(lb);
  });

  // Diversity pass: soft penalty per repeated company in sort order
  if (opts.rankByDiversity) {
    const seen = new Map<string, number>();
    for (const s of scored) {
      const key = (s.current_company ?? "").toLowerCase().trim();
      if (!key) continue;
      const n = seen.get(key) ?? 0;
      if (n === 1) s.score -= 10;
      else if (n === 2) s.score -= 20;
      else if (n >= 3) s.score -= 30;
      if (n >= 1) s.reasons.push(`${n + 1}${ordSuffix(n + 1)} pick from ${s.current_company}`);
      seen.set(key, n + 1);
    }
    // Re-sort after diversity penalties
    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const la = (a.last_name ?? "").toLowerCase();
      const lb = (b.last_name ?? "").toLowerCase();
      return la.localeCompare(lb);
    });
  }

  return scored;
}

function ordSuffix(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] ?? s[v] ?? s[0];
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
