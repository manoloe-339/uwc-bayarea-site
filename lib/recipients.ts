import { sql } from "./db";
import { searchAlumni, getAlumniByIds, type AlumniFilters } from "./alumni-query";
import { signUnsubscribeToken } from "./unsubscribe-token";

/**
 * Minimal shape used by the send flow. Matches the columns the batch API
 * actually needs, nothing more.
 */
export type Recipient = {
  id: number;
  email: string;
  first_name: string | null;
  last_name: string | null;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_RECIPIENTS = 10_000;

/**
 * Return the list of deliverable recipients for a campaign filter.
 *
 * Guarantees:
 *   - excludes unsubscribed alumni (subscribed IS FALSE)
 *   - excludes alumni flagged email_invalid (hard-bounced previously)
 *   - excludes null / blatantly invalid email addresses
 *   - dedupes by lowercase email, keeping the first matching row
 */
export async function getFilteredRecipients(
  filters: AlumniFilters
): Promise<{ list: Recipient[]; count: number; deduped: number; skipped: number }> {
  const base = filters.ids && filters.ids.length > 0
    ? await getAlumniByIds(filters.ids)
    : await searchAlumni({ ...filters, subscription: "subscribed" }, MAX_RECIPIENTS);

  // searchAlumni + getAlumniByIds don't know about email_invalid, filter here.
  const invalidIds = await loadEmailInvalidIds(base.map((r) => r.id));
  const seen = new Set<string>();
  const list: Recipient[] = [];
  let skipped = 0;
  let deduped = 0;

  for (const r of base) {
    if (r.subscribed === false) {
      skipped++;
      continue;
    }
    if (invalidIds.has(r.id)) {
      skipped++;
      continue;
    }
    if (!r.email || !EMAIL_RE.test(r.email)) {
      skipped++;
      continue;
    }
    const key = r.email.toLowerCase();
    if (seen.has(key)) {
      deduped++;
      console.warn(`[recipients] duplicate email '${key}' — keeping first occurrence`);
      continue;
    }
    seen.add(key);
    list.push({
      id: r.id,
      email: r.email,
      first_name: r.first_name,
      last_name: r.last_name,
    });
  }

  return { list, count: list.length, deduped, skipped };
}

async function loadEmailInvalidIds(ids: number[]): Promise<Set<number>> {
  if (ids.length === 0) return new Set();
  const rows = (await sql.query(
    `SELECT id FROM alumni WHERE id = ANY($1) AND email_invalid = TRUE`,
    [ids]
  )) as { id: number }[];
  return new Set(rows.map((r) => r.id));
}

export async function countFilteredRecipients(filters: AlumniFilters): Promise<number> {
  const { count } = await getFilteredRecipients(filters);
  return count;
}

export function generateUnsubscribeUrl(alumniId: number): string {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://uwcbayarea.org").replace(/\/+$/, "");
  return `${appUrl}/unsubscribe?token=${encodeURIComponent(signUnsubscribeToken(alumniId))}`;
}

/**
 * Replace {{firstName}} (and siblings we may add later) with recipient values.
 * If a token has no matching field, it's replaced with an empty string —
 * never leave a literal `{{firstName}}` in delivered email content.
 */
export function renderPersonalization(
  input: string | null | undefined,
  vars: { firstName?: string | null }
): string {
  if (!input) return "";
  return input.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, key: string) => {
    if (key === "firstName") return (vars.firstName ?? "").trim();
    return "";
  });
}
