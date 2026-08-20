/**
 * Resend account-wide daily send quota tracking.
 *
 * Resend enforces a daily cap on outbound emails, but doesn't expose
 * a "remaining quota" endpoint. We approximate it from our own
 * `email_sends` table: sum of rows with status IN ('sent','delivered')
 * created after 00:00 UTC today. Includes test sends because those
 * hit the same account.
 *
 * The cap comes from RESEND_DAILY_CAP (env var). Free tier is 100.
 * Pro plans list a monthly cap but there's still a soft daily-burst
 * cap during domain warm-up. Set the env var to whatever your plan
 * lets you send in one 24h window. Unset → 100 (fail-safe).
 */
import { sql } from "./db";

export type QuotaState = {
  cap: number;
  usedToday: number;
  remaining: number;
  pending: number;
  wouldExceed: boolean;
  overageIfSent: number;
  resetsAtUtc: string;
};

const DEFAULT_CAP = 100;

export function resendDailyCap(): number {
  const raw = process.env.RESEND_DAILY_CAP;
  if (!raw) return DEFAULT_CAP;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_CAP;
  return Math.floor(n);
}

/**
 * Count how many emails we've delivered today across every campaign
 * (test sends included — they count against the same Resend quota).
 * "Today" is UTC because Resend's quota window is UTC.
 */
export async function usedTodayCount(): Promise<number> {
  const rows = (await sql`
    SELECT COUNT(*)::int AS n
    FROM email_sends
    WHERE status IN ('sent','delivered')
      AND sent_at >= date_trunc('day', NOW() AT TIME ZONE 'UTC')
                   AT TIME ZONE 'UTC'
  `) as Array<{ n: number }>;
  return rows[0]?.n ?? 0;
}

/**
 * Compute quota state for a hypothetical send of `pending` messages.
 * Callers use this both to warn (preflight) and to hard-block a
 * send that would clearly bust the cap (sendCampaignNow).
 */
export async function checkDailyQuota(pending: number): Promise<QuotaState> {
  const cap = resendDailyCap();
  const usedToday = await usedTodayCount();
  const remaining = Math.max(0, cap - usedToday);
  const wouldExceed = pending > remaining;
  const overageIfSent = Math.max(0, pending - remaining);
  // Next UTC midnight — Resend resets the quota window here.
  const now = new Date();
  const reset = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0, 0, 0, 0,
  ));
  return {
    cap,
    usedToday,
    remaining,
    pending,
    wouldExceed,
    overageIfSent,
    resetsAtUtc: reset.toISOString(),
  };
}
