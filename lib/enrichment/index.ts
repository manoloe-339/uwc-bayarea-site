/**
 * Public surface of lib/enrichment. The rest of the codebase should
 * import exclusively from here:
 *
 *     import { triggerEnrichment } from "@/lib/enrichment";
 *
 * All other files under lib/enrichment are internal.
 */

import { sql } from "@/lib/db";
import type { EnrichmentRequest } from "@/types/enrichment";
import { startEnrichmentJob } from "./linkedin-client";
import { pollEnrichmentJob } from "./linkedin-poller";

/**
 * Kick off a LinkedIn enrichment for the given alumni row. Returns as
 * soon as the Railway service accepts the job (1–2s); the actual poll
 * continues in the background. The caller should NOT await completion
 * — the initial call is synchronous with respect to "job queued", and
 * the poll's final DB write happens fire-and-forget.
 */
export async function triggerEnrichment(
  neonId: number,
  data: EnrichmentRequest
): Promise<void> {
  try {
    const jobId = await startEnrichmentJob(neonId, data);
    await sql`
      UPDATE alumni SET
        linkedin_enrichment_status = 'pending',
        linkedin_enrichment_job_id = ${jobId},
        linkedin_enrichment_error  = NULL,
        updated_at                 = NOW()
      WHERE id = ${neonId}
    `;
    // Fire and forget — don't await. The caller's response returns now.
    pollEnrichmentJob(jobId, neonId).catch((err) => {
      console.error(`[enrichment] poll crashed for ${neonId}:`, err);
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    console.error(`[enrichment] failed to start for ${neonId}:`, err);
    await sql`
      UPDATE alumni SET
        linkedin_enrichment_status = 'failed',
        linkedin_enrichment_error  = ${msg},
        updated_at                 = NOW()
      WHERE id = ${neonId}
    `;
  }
}

export type {
  EnrichmentRequest,
  EnrichmentResult,
  EnrichmentStatus,
} from "@/types/enrichment";
