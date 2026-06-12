/**
 * Threshold-gated trigger for the focal-detection batch. Callers
 * invoke this at the end of any pipeline that may have added rows to
 * the un-detected pool (signup enrichment, re-enrichment, admin photo
 * upload). The function counts pending rows; if the count is ≥ 10, it
 * fires a POST to /api/photo-focal/run and returns immediately. The
 * actual detection happens in that route via waitUntil.
 *
 * Importantly, this file does NOT import the face-api / tfjs stack —
 * keeping the enrichment route bundle small. Only the focal API
 * route's bundle ships the WASM dependencies.
 */
import { sql } from "@/lib/db";

const THRESHOLD = 10;

// Inlined here (rather than imported from ./run-batch) so this file
// doesn't transitively drag the face-api / tfjs / sharp imports into
// the enrichment route bundle.
async function pendingFocalCount(): Promise<number> {
  const rows = (await sql`
    SELECT COUNT(*)::int AS n FROM alumni
     WHERE photo_url IS NOT NULL AND photo_focal_at IS NULL
  `) as Array<{ n: number }>;
  return rows[0]?.n ?? 0;
}

function selfUrl(): string | null {
  // Vercel sets VERCEL_URL on every deployment (preview + prod) as the
  // host without protocol. NEXT_PUBLIC_SITE_URL is the canonical prod
  // override the rest of this codebase already uses.
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/+$/, "");
  const vercel = process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`;
  return null;
}

/** Fire the focal batch if the pending count has crossed the
 *  threshold. Returns the action taken — useful for logs and tests.
 *  Never throws; trigger failures are non-fatal. */
export async function maybeTriggerFocalBatch(): Promise<
  | { kind: "below"; pending: number }
  | { kind: "triggered"; pending: number }
  | { kind: "skipped"; reason: string }
> {
  try {
    const pending = await pendingFocalCount();
    if (pending < THRESHOLD) {
      return { kind: "below", pending };
    }
    const base = selfUrl();
    if (!base) {
      return { kind: "skipped", reason: "no VERCEL_URL or NEXT_PUBLIC_SITE_URL" };
    }
    const secret = process.env.CRON_SECRET;
    if (!secret) {
      return { kind: "skipped", reason: "no CRON_SECRET" };
    }
    // Fire and forget — the focal route handles the work via
    // waitUntil and answers ~immediately. We deliberately do NOT
    // await the body so a slow batch can never block the caller.
    fetch(`${base}/api/photo-focal/run`, {
      method: "POST",
      headers: { authorization: `Bearer ${secret}` },
    }).catch((err) => {
      console.error("[focal] trigger fetch failed:", err);
    });
    console.log(`[focal] triggered batch (pending=${pending})`);
    return { kind: "triggered", pending };
  } catch (err) {
    console.error("[focal] trigger threw:", err);
    return { kind: "skipped", reason: "exception" };
  }
}
