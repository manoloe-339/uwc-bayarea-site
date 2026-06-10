import { Redis } from "@upstash/redis";
import { sql } from "@/lib/db";

/**
 * Redis-backed gate for the send-scheduled cron. The cron runs every 5 minutes
 * (see vercel.json), but each tick first checks `cron:next_due_at` here. If
 * there's nothing pending — or the next pending item is still in the future —
 * the cron returns immediately without opening a Neon connection. This is what
 * keeps Neon's compute auto-suspended when no scheduled work exists.
 *
 * The single key holds the earliest pending timestamp across all sources
 * (email_campaigns.scheduled_for and events.reminder_scheduled_at). It is
 * recomputed by refreshNextDueAt() after any insert/update/delete that could
 * affect those sets.
 *
 * Failure mode: if Redis is unreachable, isAnyDueNow() returns true (fail-open)
 * so we never silently drop scheduled sends — at worst we wake Neon for a tick.
 */

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

const KEY = "cron:next_due_at";

async function computeNextDueAt(): Promise<Date | null> {
  const rows = (await sql`
    SELECT MIN(due) AS next FROM (
      SELECT scheduled_for AS due FROM email_campaigns
        WHERE status = 'scheduled' AND scheduled_for IS NOT NULL
      UNION ALL
      SELECT reminder_scheduled_at AS due FROM events
        WHERE reminder_scheduled_at IS NOT NULL AND reminder_auto_sent_at IS NULL
    ) t
  `) as { next: Date | string | null }[];
  const raw = rows[0]?.next ?? null;
  if (raw == null) return null;
  const d = raw instanceof Date ? raw : new Date(raw);
  return Number.isFinite(d.getTime()) ? d : null;
}

// Sentinel written when the DB has no scheduled work pending — distinguishes
// "we've checked and there's nothing" (skip) from "key was never set"
// (run anyway so we can seed, e.g. immediately after deploy).
const SENTINEL_NONE = "none";

/**
 * Recompute the earliest pending scheduled timestamp from the DB and persist
 * it to Redis. Call after any mutation that could change which scheduled
 * items exist:
 *   - campaign saveDraft / scheduleAction / cancelScheduled
 *   - event reminder schedule POST
 *   - the cron itself, after processing due items
 *
 * Callers should already have a reason to touch Neon (e.g. they're writing
 * to it). This adds one tiny MIN query on top.
 */
export async function refreshNextDueAt(): Promise<Date | null> {
  const next = await computeNextDueAt();
  try {
    await redis.set(KEY, next ? next.toISOString() : SENTINEL_NONE);
  } catch (err) {
    console.error("[scheduled-work] Redis write failed:", err);
  }
  return next;
}

/**
 * Cheap read-only check used by the cron. Never opens a Neon connection.
 * Returns true (i.e. run the cron) in three cases:
 *   - key is missing (post-deploy bootstrap — cron will seed Redis)
 *   - key holds a timestamp that is now or in the past
 *   - Redis is unreachable (fail-open so scheduled sends never get silently dropped)
 * Returns false only when Redis explicitly says "none" or a future timestamp.
 */
export async function isAnyDueNow(): Promise<boolean> {
  try {
    const raw = await redis.get<string>(KEY);
    if (raw == null) return true;
    if (raw === SENTINEL_NONE) return false;
    const due = new Date(raw);
    if (!Number.isFinite(due.getTime())) return true;
    return due.getTime() <= Date.now();
  } catch (err) {
    console.error("[scheduled-work] Redis read failed — running cron anyway:", err);
    return true;
  }
}
