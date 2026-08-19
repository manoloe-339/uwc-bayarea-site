/**
 * Schedule ONE delayed re-check for a signup whose inline enrichment
 * didn't finish in time. Fires exactly once, 15 minutes after signup,
 * via Upstash QStash — not a cron. The recheck endpoint retries the
 * enrichment and emails admin if it's STILL stuck.
 *
 * Silently no-ops when QStash env vars aren't configured (local dev,
 * preview deploys without the tokens) so the signup flow never fails
 * because of missing scheduler infra.
 */
import { Client } from "@upstash/qstash";

/** Delay before the recheck fires. LinkedIn scrapes that need >120s
 *  typically finish within 5–10 min; 15 min gives comfortable headroom
 *  without keeping the signup in limbo too long. */
const RECHECK_DELAY_SECONDS = 15 * 60;

export async function scheduleEnrichmentRecheck(alumniId: number): Promise<void> {
  const token = process.env.QSTASH_TOKEN;
  const publicUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "");
  if (!token) {
    console.log(`[enrichment/recheck] QSTASH_TOKEN not set — skipping schedule for alumni ${alumniId}`);
    return;
  }
  if (!publicUrl || publicUrl.startsWith("http://localhost")) {
    console.log(`[enrichment/recheck] no public app URL — skipping schedule for alumni ${alumniId}`);
    return;
  }
  const client = new Client({ token });
  try {
    await client.publishJSON({
      url: `${publicUrl}/api/enrichment/recheck`,
      body: { alumni_id: alumniId },
      delay: RECHECK_DELAY_SECONDS,
      retries: 2,
    });
    console.log(`[enrichment/recheck] scheduled recheck for alumni ${alumniId} in ${RECHECK_DELAY_SECONDS}s`);
  } catch (err) {
    // Never let a QStash failure break the signup flow. Log and move on.
    console.error(`[enrichment/recheck] failed to schedule for alumni ${alumniId}:`, err);
  }
}
