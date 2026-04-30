import { sql } from "./db";
import { getResend, fromAddress, replyToAddress } from "./resend";
import { generateQRToken } from "./qr-code";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "https://uwcbayarea.org").replace(/\/+$/, "");

export type ReminderEvent = {
  id: number;
  name: string;
  date: Date;
  time: string | null;
  location: string | null;
  location_map_url?: string | null;
  reminder_subject?: string | null;
  reminder_heading?: string | null;
  reminder_body?: string | null;
};

/** Defaults used whenever events.reminder_* is NULL. */
export const DEFAULT_REMINDER_SUBJECT = "Tomorrow: {event} — Your QR code";
export const DEFAULT_REMINDER_HEADING = "See you tomorrow!";
export const DEFAULT_REMINDER_BODY = "You're all set for {event} tomorrow.";

export const REMINDER_PLACEHOLDERS = [
  "{name}",
  "{event}",
  "{date}",
  "{time}",
  "{location}",
  "{amount}",
] as const;

export type ReminderCopyVars = {
  name: string;
  event: string;
  date: string;
  time: string;
  location: string;
  amount: string;
};

export function interpolateReminder(template: string, vars: ReminderCopyVars): string {
  return template.replace(/\{(name|event|date|time|location|amount)\}/g, (_, k: keyof ReminderCopyVars) =>
    vars[k] ?? ""
  );
}

export type ReminderAttendee = {
  id: number;
  alumni_id: number | null;
  stripe_customer_name: string | null;
  stripe_customer_email: string | null;
  alumni_first_name: string | null;
  alumni_last_name: string | null;
  alumni_email: string | null;
  amount_paid: string;
  qr_code_data: string | null;
  name_tag_status: "pending" | "fix" | "finalized" | null;
  name_tag_first_name: string | null;
  name_tag_last_name: string | null;
  name_tag_college: string | null;
  name_tag_grad_year: number | null;
  name_tag_line_3: string | null;
  name_tag_line_4: string | null;
};

export type ReminderSummary = {
  eligible: number;
  sent: number;
  failed: number;
  skipped: number;
  errors: string[];
};

function recipientName(a: ReminderAttendee): string {
  // Greeting uses first name only — feels conversational rather than formal.
  // Fallback chain when first name isn't on file: parse the first word from
  // stripe_customer_name, then degrade to a generic 'there'.
  if (a.alumni_first_name && a.alumni_first_name.trim()) {
    return a.alumni_first_name.trim();
  }
  const stripeFull = (a.stripe_customer_name ?? "").trim();
  if (stripeFull) {
    const first = stripeFull.split(/\s+/)[0];
    if (first) return first;
  }
  return "there";
}

function recipientEmail(a: ReminderAttendee): string | null {
  return (a.alumni_email ?? a.stripe_customer_email ?? "").trim() || null;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Snapshot of an attendee's name tag for inclusion in the reminder email.
 * status === 'finalized' → confidently show what we'll print.
 * status === 'fix'       → tag known wrong; ask for correction.
 * Anything else (pending / null) → soft prompt for last-minute changes.
 */
export type NameTagSummary = {
  status: "pending" | "fix" | "finalized" | null;
  firstName: string | null;
  lastName: string | null;
  college: string | null;
  gradYear: number | null;
  line3: string | null;
  line4: string | null;
};

function tagHasAnyContent(tag: NameTagSummary): boolean {
  return Boolean(
    (tag.firstName && tag.firstName.trim()) ||
      (tag.lastName && tag.lastName.trim()) ||
      tag.college ||
      tag.gradYear ||
      tag.line3 ||
      tag.line4
  );
}

function tagBlockBody(tag: NameTagSummary): string {
  const fullName = [tag.firstName, tag.lastName].filter(Boolean).join(" ").trim();
  const collegeLine =
    tag.college && tag.gradYear
      ? `${tag.college} · ${tag.gradYear}`
      : tag.college ?? (tag.gradYear ? String(tag.gradYear) : "");
  return `
    <div style="background: #FFFFFF; border: 2px dashed #B5A88B; border-radius: 8px; padding: 20px; text-align: center;">
      ${
        fullName
          ? `<div style="font-family: Fraunces, Georgia, serif; font-weight: 700; font-size: 26px; color: #0A2540; line-height: 1.1;">${escapeHtml(fullName)}</div>`
          : `<div style="font-family: Fraunces, Georgia, serif; font-weight: 700; font-size: 26px; color: #9CA3AF; line-height: 1.1; font-style: italic;">(name not set)</div>`
      }
      ${collegeLine ? `<div style="font-size: 16px; color: #0265A8; font-weight: 600; margin-top: 6px;">${escapeHtml(collegeLine)}</div>` : ""}
      ${tag.line3 ? `<div style="font-size: 14px; color: #6B7280; font-style: italic; margin-top: 4px;">${escapeHtml(tag.line3)}</div>` : ""}
      ${tag.line4 ? `<div style="font-size: 14px; color: #6B7280; font-style: italic; margin-top: 2px;">${escapeHtml(tag.line4)}</div>` : ""}
    </div>`;
}

function renderNameTagBlockHtml(tag: NameTagSummary): string {
  if (tag.status === "finalized") {
    return `
  <div style="margin: 20px 0;">
    <div style="font-size: 11px; letter-spacing: .18em; text-transform: uppercase; color: #6B7280; font-weight: 700; margin-bottom: 10px;">
      At the door, we'll have a tag for
    </div>${tagBlockBody(tag)}
    <div style="font-size: 12px; color: #6B7280; margin-top: 10px;">
      Want it different? Just reply to this email.
    </div>
  </div>`;
  }
  if (tag.status === "fix") {
    return `
  <div style="background: #FFF7ED; border-left: 4px solid #F59E0B; padding: 14px 16px; margin: 20px 0; border-radius: 4px;">
    <strong style="color: #92400E;">We're confirming your name tag.</strong>
    <span style="color: #92400E;"> Please reply with the name and UWC affiliation (college + grad year) you'd like printed on your badge.</span>
  </div>`;
  }
  // pending / null — show what we have on file (if anything) and ask
  // for confirmation; fall back to a soft prompt when there's nothing.
  if (tagHasAnyContent(tag)) {
    return `
  <div style="margin: 20px 0;">
    <div style="font-size: 11px; letter-spacing: .18em; text-transform: uppercase; color: #92400E; font-weight: 700; margin-bottom: 10px;">
      Please confirm your name tag
    </div>${tagBlockBody(tag)}
    <div style="font-size: 12px; color: #6B7280; margin-top: 10px;">
      This is what we have on file. Reply with any corrections — different name, college, grad year — and we'll print it the way you want.
    </div>
  </div>`;
  }
  return `
  <div style="font-size: 13px; color: #6B7280; margin: 16px 0;">
    If you'd like a specific name or UWC affiliation on your badge, reply to this email and we'll print it for you.
  </div>`;
}

function tagBlockBodyText(tag: NameTagSummary): string[] {
  const fullName = [tag.firstName, tag.lastName].filter(Boolean).join(" ").trim();
  const collegeLine =
    tag.college && tag.gradYear
      ? `${tag.college} · ${tag.gradYear}`
      : tag.college ?? (tag.gradYear ? String(tag.gradYear) : "");
  return [
    `  ${fullName || "(name not set)"}`,
    collegeLine ? `  ${collegeLine}` : "",
    tag.line3 ? `  ${tag.line3}` : "",
    tag.line4 ? `  ${tag.line4}` : "",
  ].filter(Boolean);
}

function nameTagBlockText(tag: NameTagSummary): string {
  if (tag.status === "finalized") {
    return [
      "",
      "At the door, we'll have a tag for:",
      ...tagBlockBodyText(tag),
      "(Want it different? Just reply to this email.)",
    ].join("\n");
  }
  if (tag.status === "fix") {
    return [
      "",
      "We're confirming your name tag — please reply with the name and",
      "UWC affiliation (college + grad year) you'd like printed.",
    ].join("\n");
  }
  // pending / null — show what we have on file (if anything)
  if (tagHasAnyContent(tag)) {
    return [
      "",
      "Please confirm your name tag — this is what we have on file:",
      ...tagBlockBodyText(tag),
      "(Reply with any corrections — different name, college, grad year",
      "— and we'll print it the way you want.)",
    ].join("\n");
  }
  return [
    "",
    "(If you'd like a specific name or UWC affiliation on your badge,",
    "reply to this email and we'll print it for you.)",
  ].join("\n");
}

/** Split a multi-paragraph body into <p> blocks for HTML. */
function bodyParagraphsHtml(text: string): string {
  const paras = text
    .split(/\n{2,}/g)
    .map((p) => p.trim())
    .filter(Boolean);
  return paras
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br/>")}</p>`)
    .join("\n  ");
}

export function renderReminderHtml(params: {
  heading: string;
  body: string;
  recipientName: string;
  eventName: string;
  eventDate: string;
  eventTime: string | null;
  eventLocation: string | null;
  eventLocationMapUrl: string | null;
  qrImageUrl: string;
  nameTag: NameTagSummary;
}): string {
  const whenLine = params.eventTime
    ? `${escapeHtml(params.eventDate)} at ${escapeHtml(params.eventTime)}`
    : escapeHtml(params.eventDate);
  const whereLine = params.eventLocation
    ? params.eventLocationMapUrl
      ? `<a href="${escapeHtml(params.eventLocationMapUrl)}" style="color: #0265A8; text-decoration: underline;" target="_blank" rel="noopener noreferrer">${escapeHtml(params.eventLocation)}</a>`
      : escapeHtml(params.eventLocation)
    : null;
  return `<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #0A2540;">
  <h1 style="color: #0A2540; margin-bottom: 8px;">${escapeHtml(params.heading)}</h1>
  <p>Hi ${escapeHtml(params.recipientName)},</p>
  ${bodyParagraphsHtml(params.body)}
  <div style="background: #F5F0E6; padding: 20px; border-radius: 8px; margin: 20px 0; line-height: 1.6;">
    <div><strong>When:</strong> ${whenLine}</div>
    ${whereLine ? `<div><strong>Where:</strong> ${whereLine}</div>` : ""}
  </div>
  ${renderNameTagBlockHtml(params.nameTag)}
  <h2 style="color: #0A2540; font-size: 18px;">Your QR code for fast check-in</h2>
  <p>Show this QR code at the door for instant check-in:</p>
  <div style="text-align: center; margin: 24px 0;">
    <img src="${params.qrImageUrl}" alt="Your QR code" width="300" height="300" style="width: 300px; height: 300px; display: inline-block; border: 0;" />
  </div>
  <p style="text-align: center; color: #6B7280; font-size: 13px;">Can't scan? Just give your last name at check-in.</p>
  <p>Looking forward to seeing you.</p>
  <p style="margin-top: 40px; color: #6B7280; font-size: 12px; border-top: 1px solid #E5E7EB; padding-top: 16px;">
    UWC Bay Area Alumni Network
  </p>
</body>
</html>`;
}

export function renderReminderText(params: {
  heading: string;
  body: string;
  recipientName: string;
  eventDate: string;
  eventTime: string | null;
  eventLocation: string | null;
  eventLocationMapUrl: string | null;
  token: string;
  nameTag: NameTagSummary;
}): string {
  const whenLine = params.eventTime ? `${params.eventDate} at ${params.eventTime}` : params.eventDate;
  const whereLine = params.eventLocation
    ? `Where: ${params.eventLocation}${params.eventLocationMapUrl ? ` (${params.eventLocationMapUrl})` : ""}`
    : null;
  return [
    params.heading,
    "",
    `Hi ${params.recipientName},`,
    "",
    params.body,
    "",
    `When: ${whenLine}`,
    whereLine,
    nameTagBlockText(params.nameTag),
    "",
    "Your check-in code:",
    params.token,
    "",
    "(Can't scan the QR image? Just give your last name at check-in.)",
    "",
    "Looking forward to seeing you.",
    "",
    "UWC Bay Area Alumni Network",
  ]
    .filter((x): x is string => x != null)
    .join("\n");
}

/**
 * Fetch the set of attendees eligible for a reminder — optionally
 * restricted to those that don't yet have a qr_code_sent_at (the default
 * — avoids double-sending on a resume).
 */
export async function listReminderRecipients(
  eventId: number,
  opts: { onlyUnsent?: boolean } = {}
): Promise<ReminderAttendee[]> {
  const onlyUnsent = opts.onlyUnsent !== false;
  const rows = (await sql`
    SELECT
      a.id, a.alumni_id, a.stripe_customer_name, a.stripe_customer_email,
      a.amount_paid, a.qr_code_data, a.qr_code_sent_at,
      al.first_name AS alumni_first_name,
      al.last_name  AS alumni_last_name,
      al.email      AS alumni_email,
      nt.status     AS name_tag_status,
      nt.first_name AS name_tag_first_name,
      nt.last_name  AS name_tag_last_name,
      nt.uwc_college AS name_tag_college,
      nt.grad_year  AS name_tag_grad_year,
      nt.line_3     AS name_tag_line_3,
      nt.line_4     AS name_tag_line_4
    FROM event_attendees a
    LEFT JOIN alumni al ON al.id = a.alumni_id
    LEFT JOIN event_name_tags nt ON nt.attendee_id = a.id
    WHERE a.event_id = ${eventId}
      AND a.deleted_at IS NULL
      AND a.attendee_type IN ('paid', 'comp')
      AND a.qr_code_data IS NOT NULL
      AND (
        al.email IS NOT NULL
        OR (a.stripe_customer_email IS NOT NULL AND a.stripe_customer_email <> '')
      )
  `) as (ReminderAttendee & { qr_code_sent_at: Date | null })[];
  return onlyUnsent ? rows.filter((r) => !r.qr_code_sent_at) : rows;
}

/**
 * Ensure every eligible attendee has a qr_code_data token. Returns how
 * many were freshly generated. Existing tokens are preserved — regenerating
 * would invalidate previously emailed codes.
 */
export async function generateMissingQRTokens(eventId: number): Promise<number> {
  const rows = (await sql`
    SELECT id FROM event_attendees
    WHERE event_id = ${eventId}
      AND deleted_at IS NULL
      AND attendee_type IN ('paid', 'comp')
      AND qr_code_data IS NULL
  `) as { id: number }[];
  for (const r of rows) {
    const token = generateQRToken(r.id, eventId);
    await sql`UPDATE event_attendees SET qr_code_data = ${token}, updated_at = NOW() WHERE id = ${r.id}`;
  }
  return rows.length;
}

/**
 * Send the reminder email to one attendee and stamp qr_code_sent_at on
 * success. Throws on Resend / DB errors so the caller can count failures.
 */
export async function sendReminderToAttendee(
  attendee: ReminderAttendee,
  event: ReminderEvent
): Promise<{ messageId: string }> {
  if (!attendee.qr_code_data) throw new Error("Missing qr_code_data");
  const to = recipientEmail(attendee);
  if (!to || !to.includes("@")) throw new Error("No recipient email");

  const qrImageUrl = `${APP_URL}/api/qr/${encodeURIComponent(attendee.qr_code_data)}`;
  const dateStr = formatDate(new Date(event.date));
  const vars: ReminderCopyVars = {
    name: recipientName(attendee),
    event: event.name,
    date: dateStr,
    time: event.time ?? "",
    location: event.location ?? "",
    amount: `$${Number(attendee.amount_paid || 0).toFixed(2)}`,
  };
  const subject = interpolateReminder(
    event.reminder_subject ?? DEFAULT_REMINDER_SUBJECT,
    vars
  );
  const heading = interpolateReminder(
    event.reminder_heading ?? DEFAULT_REMINDER_HEADING,
    vars
  );
  const body = interpolateReminder(
    event.reminder_body ?? DEFAULT_REMINDER_BODY,
    vars
  );
  const nameTag: NameTagSummary = {
    status: attendee.name_tag_status,
    firstName: attendee.name_tag_first_name,
    lastName: attendee.name_tag_last_name,
    college: attendee.name_tag_college,
    gradYear: attendee.name_tag_grad_year,
    line3: attendee.name_tag_line_3,
    line4: attendee.name_tag_line_4,
  };
  const html = renderReminderHtml({
    heading,
    body,
    recipientName: vars.name,
    eventName: event.name,
    eventDate: dateStr,
    eventTime: event.time,
    eventLocation: event.location,
    eventLocationMapUrl: event.location_map_url ?? null,
    qrImageUrl,
    nameTag,
  });
  const text = renderReminderText({
    heading,
    body,
    recipientName: vars.name,
    eventDate: dateStr,
    eventTime: event.time,
    eventLocation: event.location,
    eventLocationMapUrl: event.location_map_url ?? null,
    token: attendee.qr_code_data,
    nameTag,
  });

  const resend = getResend();
  const result = await resend.emails.send({
    from: fromAddress(),
    to,
    replyTo: replyToAddress(),
    subject,
    html,
    text,
  });
  if ("error" in result && result.error) {
    throw new Error(result.error.message ?? "send failed");
  }
  const id = "data" in result && result.data ? result.data.id : "";

  await sql`
    INSERT INTO email_sends (
      event_attendee_id, alumni_id, email, subject, body,
      resend_message_id, status, sent_at, kind
    ) VALUES (
      ${attendee.id}, NULL, ${to},
      ${subject}, ${text},
      ${id || null}, 'sent', NOW(), 'event_reminder'
    )
  `;
  await sql`
    UPDATE event_attendees SET qr_code_sent_at = NOW(), updated_at = NOW()
    WHERE id = ${attendee.id}
  `;
  return { messageId: id };
}

/**
 * Send reminders to every eligible attendee, with a small concurrency
 * cap so Resend doesn't rate-limit. Resumes naturally: onlyUnsent default
 * skips attendees whose qr_code_sent_at is already set.
 */
export async function sendRemindersForEvent(
  event: ReminderEvent,
  opts: { concurrency?: number; onlyUnsent?: boolean } = {}
): Promise<ReminderSummary> {
  const concurrency = Math.max(1, Math.min(opts.concurrency ?? 5, 10));
  const attendees = await listReminderRecipients(event.id, { onlyUnsent: opts.onlyUnsent });
  const summary: ReminderSummary = {
    eligible: attendees.length,
    sent: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };

  let cursor = 0;
  const next = () => (cursor < attendees.length ? attendees[cursor++] : null);
  const workers: Promise<void>[] = [];
  for (let i = 0; i < concurrency; i++) {
    workers.push(
      (async () => {
        while (true) {
          const a = next();
          if (!a) return;
          try {
            await sendReminderToAttendee(a, event);
            summary.sent++;
          } catch (err) {
            summary.failed++;
            summary.errors.push(`attendee ${a.id}: ${err instanceof Error ? err.message : String(err)}`);
          }
        }
      })()
    );
  }
  await Promise.all(workers);
  return summary;
}
