/**
 * Polls the Railway service until a job finishes, then applies the
 * result. Runs as a fire-and-forget after the initial API response
 * (see index.ts). Internal to lib/enrichment.
 *
 * Caveat: on Vercel serverless, fire-and-forget isn't strictly
 * guaranteed to run to completion after the parent response flushes.
 * Fluid Compute tends to keep the worker alive but a timeout-prone
 * alternative is to store job_id and poll from a cron. Part B/C will
 * formalise that if this proves flaky in prod.
 */

import { sql } from "@/lib/db";
import type { EnrichmentResult } from "@/types/enrichment";
import { getJobStatus } from "./linkedin-client";
import { downloadAndUploadPhoto } from "./photo-uploader";
import { transformEnrichmentResult } from "./data-transformer";
import { ENRICHMENT_CONFIG } from "./constants";

export async function pollEnrichmentJob(
  jobId: string,
  neonId: number
): Promise<void> {
  for (let attempt = 0; attempt < ENRICHMENT_CONFIG.MAX_POLL_ATTEMPTS; attempt++) {
    await new Promise((resolve) =>
      setTimeout(resolve, ENRICHMENT_CONFIG.POLL_INTERVAL_MS)
    );

    try {
      const status = await getJobStatus(jobId);

      if (status.status === "done") {
        if (!status.result) {
          await markFailed(neonId, "Service returned done without result");
          return;
        }
        await handleEnrichmentSuccess(neonId, status.result);
        return;
      }

      if (status.status === "failed") {
        await markFailed(neonId, status.error ?? "Unknown service error");
        return;
      }

      // queued / running — continue polling.
    } catch (err) {
      console.error(
        `[enrichment] poll attempt ${attempt + 1} for ${neonId} failed:`,
        err
      );
      // Don't mark failed on transient errors; keep polling.
    }
  }

  await markFailed(neonId, "Enrichment timeout (>100 seconds)");
}

async function handleEnrichmentSuccess(
  neonId: number,
  result: EnrichmentResult
): Promise<void> {
  try {
    // "Needs review" short-circuits: we stash the raw result and let the
    // admin disambiguate candidates in the Part B review queue.
    if (result.needs_review) {
      await sql`
        UPDATE alumni SET
          linkedin_enrichment_status = 'needs_review',
          linkedin_raw_data = ${JSON.stringify(result)}::jsonb,
          linkedin_enriched_at = NOW(),
          updated_at = NOW()
        WHERE id = ${neonId}
      `;
      return;
    }

    let photoUrl: string | null = null;
    if (result.photo_url) {
      photoUrl = await downloadAndUploadPhoto(result.photo_url, neonId);
    }

    const patch = transformEnrichmentResult(result, photoUrl);

    await sql`
      UPDATE alumni SET
        linkedin_url               = ${patch.linkedin_url},
        linkedin_alternate_email   = COALESCE(${patch.linkedin_alternate_email}, linkedin_alternate_email),
        headline                   = COALESCE(${patch.headline}, headline),
        about                      = COALESCE(${patch.about}, about),
        location_city              = COALESCE(${patch.location_city}, location_city),
        location_country           = COALESCE(${patch.location_country}, location_country),
        photo_url                  = COALESCE(${patch.photo_url}, photo_url),
        current_company            = COALESCE(${patch.current_company}, current_company),
        current_title              = COALESCE(${patch.current_title}, current_title),
        uwc_verified               = ${patch.uwc_verified},
        linkedin_enrichment_status = ${patch.linkedin_enrichment_status},
        linkedin_enriched_at       = ${patch.linkedin_enriched_at},
        linkedin_raw_data          = ${JSON.stringify(patch.linkedin_raw_data)}::jsonb,
        linkedin_enrichment_error  = NULL,
        updated_at                 = NOW()
      WHERE id = ${neonId}
    `;
    console.log(`[enrichment] ✓ complete for alumni ${neonId}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    console.error(`[enrichment] save failed for ${neonId}:`, err);
    await markFailed(neonId, `Save failed: ${msg}`);
  }
}

async function markFailed(neonId: number, reason: string): Promise<void> {
  await sql`
    UPDATE alumni SET
      linkedin_enrichment_status = 'failed',
      linkedin_enrichment_error  = ${reason},
      updated_at                 = NOW()
    WHERE id = ${neonId}
  `;
}
