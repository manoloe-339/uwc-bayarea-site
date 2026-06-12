import { waitUntil } from "@vercel/functions";
import { runFocalBatch } from "@/lib/photo-focal/run-batch";

export const dynamic = "force-dynamic";
// Detection time scales with the backlog. Threshold-of-10 batches
// typically run in 30–60 s on WASM CPU; cap at the Fluid Compute
// default ceiling so a degenerate run still terminates.
export const maxDuration = 300;

/**
 * Internal endpoint that runs the focal-detection batch. Triggered by
 * the enrichment pipeline when the count of un-detected photos crosses
 * the threshold. Not user-facing — gated by CRON_SECRET (same secret
 * the scheduled-campaigns cron uses, since both are internal).
 *
 * The detection runs via waitUntil so the response can return
 * immediately — caller doesn't have to wait minutes for completion.
 */
export async function POST(req: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return new Response("CRON_SECRET not configured", { status: 500 });
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return new Response("unauthorized", { status: 401 });
  }

  waitUntil(
    runFocalBatch().catch((err) => {
      console.error("[focal] batch failed:", err);
    }),
  );
  return Response.json({ ok: true, started: true });
}
