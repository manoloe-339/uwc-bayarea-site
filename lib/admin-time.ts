/**
 * Pacific-Time date formatters for admin pages.
 *
 * Server-rendered Next.js pages run in UTC on Vercel. Calling
 * `new Date(iso).toLocaleString()` without a timeZone option lands the admin
 * on UTC, which is confusing. Every admin-surface timestamp should go through
 * one of these helpers so the displayed time always matches the real Bay Area
 * clock regardless of where the code runs.
 */

const TZ = "America/Los_Angeles";
const LOCALE = "en-US";

/** "Apr 20, 2026, 2:55 PM PT" */
export function fmtDateTime(iso: string | Date | null | undefined): string {
  if (!iso) return "—";
  const d = iso instanceof Date ? iso : new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  return d.toLocaleString(LOCALE, {
    timeZone: TZ,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }) + " PT";
}

/** "Apr 20, 2:55 PM" — no year or timezone suffix, for dense tables */
export function fmtDateTimeShort(iso: string | Date | null | undefined): string {
  if (!iso) return "—";
  const d = iso instanceof Date ? iso : new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  return d.toLocaleString(LOCALE, {
    timeZone: TZ,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** "Apr 20, 2026" */
export function fmtDate(iso: string | Date | null | undefined): string {
  if (!iso) return "—";
  const d = iso instanceof Date ? iso : new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  return d.toLocaleDateString(LOCALE, {
    timeZone: TZ,
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
