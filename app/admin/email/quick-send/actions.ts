"use server";

import { sql } from "@/lib/db";
import { getResend, fromAddress, replyToAddress } from "@/lib/resend";
import { renderEmailHtml, renderEmailText } from "@/lib/email";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_PER_SEND = 200;

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
  valid: { email: string; alumni_id: number | null; first_name: string | null }[];
  invalid: string[];
  unsubscribed: { email: string; first_name: string | null }[];
  duplicates: number;
}> {
  const tokens = rawEmails.split(/[\s,;]+/).map((t) => t.trim()).filter(Boolean);
  const seen = new Set<string>();
  const accepted: string[] = [];
  const invalid: string[] = [];
  let duplicates = 0;
  for (const t of tokens) {
    const lc = t.toLowerCase();
    if (seen.has(lc)) {
      duplicates++;
      continue;
    }
    seen.add(lc);
    if (EMAIL_RE.test(t)) accepted.push(lc);
    else invalid.push(t);
  }

  if (accepted.length === 0) {
    return { valid: [], invalid, unsubscribed: [], duplicates };
  }

  const matches = (await sql`
    SELECT id, LOWER(email) AS email, first_name, subscribed, email_invalid
    FROM alumni
    WHERE LOWER(email) = ANY(${accepted})
  `) as AlumniMatch[];
  const byEmail = new Map<string, AlumniMatch>();
  for (const m of matches) byEmail.set(m.email, m);

  const valid: { email: string; alumni_id: number | null; first_name: string | null }[] = [];
  const unsubscribed: { email: string; first_name: string | null }[] = [];
  for (const e of accepted) {
    const m = byEmail.get(e);
    if (m && (m.subscribed === false || m.email_invalid === true)) {
      unsubscribed.push({ email: e, first_name: m.first_name });
      continue;
    }
    valid.push({
      email: e,
      alumni_id: m?.id ?? null,
      first_name: m?.first_name ?? null,
    });
  }

  return { valid, invalid, unsubscribed, duplicates };
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

  if (!subject) return { ok: false, error: "Subject is required" };
  if (!body) return { ok: false, error: "Body is required" };

  const { valid, invalid, unsubscribed } = await parseAndPreview(rawEmails);
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
