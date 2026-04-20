import { sql } from "@/lib/db";
import { sendCampaignNow } from "@/lib/campaign-send";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes — enough headroom for a ~500-recipient send

/**
 * Vercel Cron endpoint — runs every 5 minutes (see vercel.json). Picks up any
 * campaigns whose status='scheduled' and scheduled_for <= now(), and invokes
 * sendCampaignNow on each.
 *
 * Authorization: Vercel Cron automatically sets
 *   Authorization: Bearer <CRON_SECRET>
 * on every invocation when CRON_SECRET is configured in project env vars. We
 * reject any request lacking that header so the endpoint isn't internet-reachable.
 */
export async function GET(req: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // Safer to fail closed than to run unauthenticated in a misconfigured env.
    return new Response("CRON_SECRET not configured", { status: 500 });
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return new Response("unauthorized", { status: 401 });
  }

  const due = (await sql`
    SELECT id FROM email_campaigns
    WHERE status = 'scheduled'
      AND scheduled_for IS NOT NULL
      AND scheduled_for <= NOW()
    ORDER BY scheduled_for ASC
    LIMIT 10
  `) as { id: string }[];

  if (due.length === 0) {
    return Response.json({ ok: true, picked: 0, ran: [] });
  }

  const results: Array<{
    id: string;
    ok: boolean;
    sent?: number;
    failed?: number;
    error?: string;
  }> = [];

  for (const row of due) {
    try {
      const r = await sendCampaignNow(row.id);
      if (r.ok) {
        results.push({ id: row.id, ok: true, sent: r.sent, failed: r.failed });
      } else {
        results.push({ id: row.id, ok: false, error: r.error });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "unknown";
      results.push({ id: row.id, ok: false, error: msg });
      console.error(`[cron/send-scheduled] campaign=${row.id} threw:`, err);
    }
  }

  return Response.json({ ok: true, picked: due.length, ran: results });
}
