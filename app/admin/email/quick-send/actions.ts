"use server";

import { sql } from "@/lib/db";
import { getResend, fromAddress, replyToAddress } from "@/lib/resend";
import { renderEmailHtml, renderEmailText } from "@/lib/email";

// Match an email-shaped substring anywhere in the input. RFC-y, not RFC-strict.
// Tolerates surrounding quotes, angle brackets, names, parentheses, etc.
const EMAIL_FIND_RE = /[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/g;
const MAX_PER_SEND = 200;

type ExtractedRecipient = {
  email: string;
  parsedName: string | null;
  parsedFirstName: string | null;
};

/**
 * Walk the input line-by-line. For each email, the candidate "name" is text
 * on the same line *before* the email (e.g. "First Last <email>" — Outlook
 * style), or the most recent non-empty line above (e.g. "First Last\nemail").
 * Best-effort heuristic; works for typical paste shapes.
 *
 * Internal helper, NOT exported: files with "use server" may only export
 * async functions (server actions). Keeping this private avoids that error.
 */
function extractRecipients(raw: string): ExtractedRecipient[] {
  const lines = raw.split(/\r?\n/);
  const seen = new Set<string>();
  const out: ExtractedRecipient[] = [];

  let prevNonEmpty: string | null = null;

  for (const line of lines) {
    const emailsInLine = [...line.matchAll(EMAIL_FIND_RE)];
    if (emailsInLine.length === 0) {
      const trimmed = line.trim();
      prevNonEmpty = trimmed || null;
      continue;
    }

    for (const m of emailsInLine) {
      const email = m[0].toLowerCase();
      if (seen.has(email)) continue;
      seen.add(email);

      let nameText = line.slice(0, m.index ?? 0).trim();
      nameText = nameText.replace(/<\s*$/, "").replace(/[“”"']/g, "").trim();

      if (!nameText && prevNonEmpty) {
        nameText = prevNonEmpty.replace(/[“”"']/g, "").trim();
      }

      const parsedName = nameText || null;
      const parsedFirstName = extractFirstName(parsedName);
      out.push({ email, parsedName, parsedFirstName });
    }

    prevNonEmpty = null;
  }

  return out;
}

function extractFirstName(name: string | null): string | null {
  if (!name) return null;
  const cleaned = name.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return null;
  const firstWord = cleaned.split(" ")[0];
  if (!/^[A-Za-zÀ-ſ][A-Za-zÀ-ſ'\-]*$/.test(firstWord)) return null;
  return firstWord;
}

export type QuickSendResult =
  | { ok: true; campaignId: string; sent: number; failed: number; matched: number; unmatched: number; unsubscribed: number; invalid: number }
  | { ok: false; error: string };

type AlumniMatch = {
  id: number;
  email: string;
  first_name: string | null;
  subscribed: boolean | null;
  email_invalid: boolean | null;
};

export async function parseAndPreview(rawEmails: string): Promise<{
  valid: { email: string; alumni_id: number | null; first_name: string | null; source: "parsed" | "alumni" | null }[];
  invalid: string[];
  unsubscribed: { email: string; first_name: string | null }[];
  duplicates: number;
}> {
  const extracted = extractRecipients(rawEmails);
  const accepted = extracted.map((r) => r.email);
  const duplicates = (rawEmails.match(EMAIL_FIND_RE)?.length ?? 0) - accepted.length;

  if (accepted.length === 0) {
    return { valid: [], invalid: [], unsubscribed: [], duplicates: Math.max(0, duplicates) };
  }

  const matches = (await sql`
    SELECT id, LOWER(email) AS email, first_name, subscribed, email_invalid
    FROM alumni
    WHERE LOWER(email) = ANY(${accepted})
  `) as AlumniMatch[];
  const byEmail = new Map<string, AlumniMatch>();
  for (const m of matches) byEmail.set(m.email, m);

  const valid: { email: string; alumni_id: number | null; first_name: string | null; source: "parsed" | "alumni" | null }[] = [];
  const unsubscribed: { email: string; first_name: string | null }[] = [];
  for (const r of extracted) {
    const m = byEmail.get(r.email);
    if (m && (m.subscribed === false || m.email_invalid === true)) {
      unsubscribed.push({ email: r.email, first_name: r.parsedFirstName ?? m.first_name });
      continue;
    }
    // Prefer name parsed from the paste (admin's intent) over alumni record.
    const firstName = r.parsedFirstName ?? m?.first_name ?? null;
    const source: "parsed" | "alumni" | null = r.parsedFirstName
      ? "parsed"
      : m?.first_name
      ? "alumni"
      : null;
    valid.push({
      email: r.email,
      alumni_id: m?.id ?? null,
      first_name: firstName,
      source,
    });
  }

  return { valid, invalid: [], unsubscribed, duplicates: Math.max(0, duplicates) };
}

function buildBody(args: {
  body: string;
  salutation: string;
  includeFirstName: boolean;
  firstName: string | null;
}): string {
  const sal = args.salutation.trim();
  if (!sal) return args.body;
  const name = args.includeFirstName ? ` ${args.firstName?.trim() || "there"}` : "";
  return `${sal}${name},\n\n${args.body}`;
}

export async function sendQuickList(_prev: QuickSendResult | null, fd: FormData): Promise<QuickSendResult> {
  const subject = String(fd.get("subject") ?? "").trim();
  const body = String(fd.get("body") ?? "").trim();
  const salutation = String(fd.get("salutation") ?? "Hi").trim();
  const includeFirstName = fd.get("includeFirstName") === "on";
  const rawEmails = String(fd.get("emails") ?? "");
  const nameOverridesRaw = String(fd.get("nameOverrides") ?? "");
  let nameOverrides: Record<string, string> = {};
  try {
    if (nameOverridesRaw) {
      const parsed = JSON.parse(nameOverridesRaw);
      if (parsed && typeof parsed === "object") {
        nameOverrides = Object.fromEntries(
          Object.entries(parsed)
            .filter(([k, v]) => typeof k === "string" && typeof v === "string")
            .map(([k, v]) => [k.toLowerCase(), v as string])
        );
      }
    }
  } catch {
    // ignore malformed override blob; fall back to parsed/alumni names
  }

  if (!subject) return { ok: false, error: "Subject is required" };
  if (!body) return { ok: false, error: "Body is required" };

  const { valid, unsubscribed } = await parseAndPreview(rawEmails);
  const invalid: string[] = [];

  // Apply admin's per-recipient name overrides (entered in the preview list).
  for (const r of valid) {
    if (Object.prototype.hasOwnProperty.call(nameOverrides, r.email)) {
      const overrideFirst = extractFirstName(nameOverrides[r.email]);
      r.first_name = overrideFirst;
    }
  }
  if (valid.length === 0) {
    return { ok: false, error: "No valid, deliverable email addresses to send to" };
  }
  if (valid.length > MAX_PER_SEND) {
    return { ok: false, error: `Too many recipients (${valid.length}); cap is ${MAX_PER_SEND} per quick-send` };
  }

  // Create the campaign row so this shows up in the Campaigns tab.
  const filterSnapshot = { mode: "custom_list", count: valid.length };
  const campaignRows = (await sql`
    INSERT INTO email_campaigns (
      subject, body, format, mode, status,
      filter_snapshot, recipient_count
    ) VALUES (
      ${subject}, ${body}, 'quick_note', 'custom_list', 'sending',
      ${JSON.stringify(filterSnapshot)}::jsonb, ${valid.length}
    )
    RETURNING id
  `) as { id: string }[];
  const campaignId = campaignRows[0].id;

  const resend = getResend();
  const from = fromAddress();
  const replyTo = replyToAddress();

  let sent = 0;
  let failed = 0;
  let matched = 0;
  let unmatched = 0;

  for (const r of valid) {
    if (r.alumni_id != null) matched++;
    else unmatched++;
    const personalized = buildBody({
      body,
      salutation,
      includeFirstName,
      firstName: r.first_name,
    });
    const html = renderEmailHtml(personalized, r.alumni_id);
    const text = renderEmailText(personalized, r.alumni_id);
    try {
      const result = await resend.emails.send({
        from,
        to: r.email,
        replyTo,
        subject,
        html,
        text,
      });
      const id = "data" in result && result.data ? result.data.id : "";
      const errMsg =
        "error" in result && result.error ? result.error.message ?? "send failed" : null;

      await sql`
        INSERT INTO email_sends (
          campaign_id, alumni_id, email, subject, body,
          resend_message_id, status, sent_at, kind
        ) VALUES (
          ${campaignId}, ${r.alumni_id}, ${r.email},
          ${subject}, ${personalized},
          ${id || null}, ${errMsg ? "failed" : "sent"}, NOW(), 'campaign'
        )
        ON CONFLICT DO NOTHING
      `;
      if (errMsg) failed++;
      else sent++;
    } catch (err) {
      failed++;
      const msg = err instanceof Error ? err.message : "send threw";
      await sql`
        INSERT INTO email_sends (
          campaign_id, alumni_id, email, subject, body,
          status, error, sent_at, kind
        ) VALUES (
          ${campaignId}, ${r.alumni_id}, ${r.email},
          ${subject}, ${body},
          'failed', ${msg}, NOW(), 'campaign'
        )
        ON CONFLICT DO NOTHING
      `;
    }
  }

  await sql`
    UPDATE email_campaigns
    SET status = ${failed === valid.length ? "failed" : "sent"},
        sent_count = ${sent}, failed_count = ${failed},
        sent_at = NOW()
    WHERE id = ${campaignId}
  `;

  return {
    ok: true,
    campaignId,
    sent,
    failed,
    matched,
    unmatched,
    unsubscribed: unsubscribed.length,
    invalid: invalid.length,
  };
}
