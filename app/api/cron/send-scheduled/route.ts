import { sql } from "@/lib/db";
import { sendCampaignNow } from "@/lib/campaign-send";
import { sendRemindersForEvent } from "@/lib/attendee-reminder";

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

  // Scheduled ticket-event reminders. Same gate: reminder_scheduled_at in
  // the past AND not yet auto-sent. Stamped atomically so a second cron
  // tick before this one finishes can't fire twice.
  const dueEvents = (await sql`
    UPDATE events
    SET reminder_auto_sent_at = NOW(), updated_at = NOW()
    WHERE id IN (
      SELECT id FROM events
      WHERE reminder_scheduled_at IS NOT NULL
        AND reminder_auto_sent_at IS NULL
        AND reminder_scheduled_at <= NOW()
      ORDER BY reminder_scheduled_at ASC
      LIMIT 10
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, slug, name, date, time, location,
              reminder_subject, reminder_heading, reminder_body
  `) as {
    id: number;
    slug: string;
    name: string;
    date: Date;
    time: string | null;
    location: string | null;
    reminder_subject: string | null;
    reminder_heading: string | null;
    reminder_body: string | null;
  }[];

  const eventResults: Array<{
    id: number;
    slug: string;
    ok: boolean;
    sent?: number;
    failed?: number;
    error?: string;
  }> = [];

  for (const ev of dueEvents) {
    try {
      const summary = await sendRemindersForEvent(
        {
          id: ev.id,
          name: ev.name,
          date: ev.date,
          time: ev.time,
          location: ev.location,
          reminder_subject: ev.reminder_subject,
          reminder_heading: ev.reminder_heading,
          reminder_body: ev.reminder_body,
        },
        { onlyUnsent: true, concurrency: 5 }
      );
      eventResults.push({
        id: ev.id,
        slug: ev.slug,
        ok: summary.failed === 0,
        sent: summary.sent,
        failed: summary.failed,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "unknown";
      eventResults.push({ id: ev.id, slug: ev.slug, ok: false, error: msg });
      console.error(`[cron/send-scheduled] event=${ev.id} threw:`, err);
    }
  }

  return Response.json({
    ok: true,
    picked: due.length,
    ran: results,
    events_picked: dueEvents.length,
    events_ran: eventResults,
  });
}
