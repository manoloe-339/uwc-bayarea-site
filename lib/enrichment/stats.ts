import { sql } from "../db";

export type EnrichmentCounts = {
  total: number;
  attempted: number;
  complete: number;
  pending: number;
  needsReview: number;
  failed: number;
  failedAdminRejected: number;
  failedApi: number;
  never: number;
  /** complete / attempted, 0–1, or null if attempted=0 */
  successRate: number | null;
  /** Subset of complete rows whose linkedin_raw_data.source = manual_override. */
  manualOverrides: number;
};

export async function getEnrichmentCounts(): Promise<EnrichmentCounts> {
  const rows = (await sql`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE linkedin_enrichment_status IS NOT NULL)::int AS attempted,
      COUNT(*) FILTER (WHERE linkedin_enrichment_status = 'complete')::int AS complete,
      COUNT(*) FILTER (WHERE linkedin_enrichment_status = 'pending')::int AS pending,
      COUNT(*) FILTER (WHERE linkedin_enrichment_status = 'needs_review')::int AS needs_review,
      COUNT(*) FILTER (WHERE linkedin_enrichment_status = 'failed')::int AS failed,
      COUNT(*) FILTER (
        WHERE linkedin_enrichment_status = 'failed'
          AND linkedin_enrichment_error LIKE '%admin rejected%'
      )::int AS failed_admin_rejected,
      COUNT(*) FILTER (WHERE linkedin_enrichment_status IS NULL)::int AS never,
      COUNT(*) FILTER (
        WHERE linkedin_enrichment_status = 'complete'
          AND linkedin_raw_data->>'source' = 'manual_override'
      )::int AS manual_overrides
    FROM alumni
    WHERE deceased IS NOT TRUE
  `) as {
    total: number;
    attempted: number;
    complete: number;
    pending: number;
    needs_review: number;
    failed: number;
    failed_admin_rejected: number;
    never: number;
    manual_overrides: number;
  }[];
  const r = rows[0];
  const successRate =
    r.attempted > 0 ? r.complete / r.attempted : null;
  return {
    total: r.total,
    attempted: r.attempted,
    complete: r.complete,
    pending: r.pending,
    needsReview: r.needs_review,
    failed: r.failed,
    failedAdminRejected: r.failed_admin_rejected,
    failedApi: r.failed - r.failed_admin_rejected,
    never: r.never,
    successRate,
    manualOverrides: r.manual_overrides,
  };
}
