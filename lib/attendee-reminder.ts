import { sql } from "./db";
import { getResend, fromAddress, replyToAddress } from "./resend";
import { generateQRToken, renderQRDataUrl } from "./qr-code";

export type ReminderEvent = {
  id: number;
  name: string;
  date: Date;
  time: string | null;
  location: string | null;
};

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
};

export type ReminderSummary = {
  eligible: number;
  sent: number;
  failed: number;
  skipped: number;
  errors: string[];
};

function recipientName(a: ReminderAttendee): string {
  const alumni = [a.alumni_first_name, a.alumni_last_name].filter(Boolean).join(" ");
  return alumni || a.stripe_customer_name || a.alumni_email || a.stripe_customer_email || "there";
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

function renderHtml(params: {
  recipientName: string;
  eventName: string;
  eventDate: string;
  eventTime: string | null;
  eventLocation: string | null;
  amountPaid: string;
  qrDataUrl: string;
}): string {
  const whenLine = params.eventTime
    ? `${escapeHtml(params.eventDate)} at ${escapeHtml(params.eventTime)}`
    : escapeHtml(params.eventDate);
  return `<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #0A2540;">
  <h1 style="color: #0A2540; margin-bottom: 8px;">See you tomorrow!</h1>
  <p>Hi ${escapeHtml(params.recipientName)},</p>
  <p>You're all set for <strong>${escapeHtml(params.eventName)}</strong> tomorrow.</p>
  <div style="background: #F5F0E6; padding: 20px; border-radius: 8px; margin: 20px 0; line-height: 1.6;">
    <div><strong>When:</strong> ${whenLine}</div>
    ${params.eventLocation ? `<div><strong>Where:</strong> ${escapeHtml(params.eventLocation)}</div>` : ""}
    <div><strong>Ticket:</strong> $${Number(params.amountPaid || 0).toFixed(2)}</div>
  </div>
  <h2 style="color: #0A2540; font-size: 18px;">Your QR code for fast check-in</h2>
  <p>Show this QR code at the door for instant check-in:</p>
  <div style="text-align: center; margin: 24px 0;">
    <img src="${params.qrDataUrl}" alt="Your QR code" width="300" height="300" style="width: 300px; height: 300px; display: inline-block;" />
  </div>
  <p style="text-align: center; color: #6B7280; font-size: 13px;">Can't scan? Just give your last name at check-in.</p>
  <p>Looking forward to seeing you.</p>
  <p style="margin-top: 40px; color: #6B7280; font-size: 12px; border-top: 1px solid #E5E7EB; padding-top: 16px;">
    UWC Bay Area Alumni Network
  </p>
</body>
</html>`;
}

function renderText(params: {
  recipientName: string;
  eventName: string;
  eventDate: string;
  eventTime: string | null;
  eventLocation: string | null;
  amountPaid: string;
  token: string;
}): string {
  const whenLine = params.eventTime ? `${params.eventDate} at ${params.eventTime}` : params.eventDate;
  return [
    `Hi ${params.recipientName},`,
    "",
    `You're all set for ${params.eventName} tomorrow.`,
    "",
    `When: ${whenLine}`,
    params.eventLocation ? `Where: ${params.eventLocation}` : null,
    `Ticket: $${Number(params.amountPaid || 0).toFixed(2)}`,
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
      al.email      AS alumni_email
    FROM event_attendees a
    LEFT JOIN alumni al ON al.id = a.alumni_id
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

  const qrDataUrl = await renderQRDataUrl(attendee.qr_code_data);
  const subject = `Tomorrow: ${event.name} — Your QR code`;
  const html = renderHtml({
    recipientName: recipientName(attendee),
    eventName: event.name,
    eventDate: formatDate(new Date(event.date)),
    eventTime: event.time,
    eventLocation: event.location,
    amountPaid: attendee.amount_paid,
    qrDataUrl,
  });
  const text = renderText({
    recipientName: recipientName(attendee),
    eventName: event.name,
    eventDate: formatDate(new Date(event.date)),
    eventTime: event.time,
    eventLocation: event.location,
    amountPaid: attendee.amount_paid,
    token: attendee.qr_code_data,
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
