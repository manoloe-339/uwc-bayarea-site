import { NextResponse, type NextRequest } from "next/server";
import { Webhook } from "svix";
import { sql } from "@/lib/db";
import { sendTestEmail } from "@/lib/email-send";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HANDLED_EVENTS = new Set([
  "email.sent",
  "email.delivered",
  "email.opened",
  "email.clicked",
  "email.bounced",
  "email.complained",
]);

type ResendBounce = { type?: string; message?: string; subType?: string };
type ResendClick = { link?: string };
type ResendEvent = {
  type: string;
  created_at?: string;
  data?: {
    email_id?: string;
    to?: string | string[];
    bounce?: ResendBounce;
    click?: ResendClick;
  };
};

type SendRow = {
  id: string;
  campaign_id: string | null;
  alumni_id: number | null;
  email: string | null;
  subject: string | null;
};

export async function POST(req: NextRequest) {
  const body = await req.text();

  const headers = {
    "svix-id": req.headers.get("svix-id") ?? "",
    "svix-timestamp": req.headers.get("svix-timestamp") ?? "",
    "svix-signature": req.headers.get("svix-signature") ?? "",
  };

  const secret = process.env.RESEND_WEBHOOK_SECRET;
  let event: ResendEvent;

  if (secret) {
    try {
      const wh = new Webhook(secret);
      event = wh.verify(body, headers) as ResendEvent;
    } catch (err) {
      console.warn("[resend webhook] signature verification failed:", err);
      return NextResponse.json({ error: "invalid signature" }, { status: 401 });
    }
  } else {
    console.warn(
      "[resend webhook] RESEND_WEBHOOK_SECRET not set — accepting event without signature check."
    );
    try {
      event = JSON.parse(body) as ResendEvent;
    } catch {
      return NextResponse.json({ error: "invalid json" }, { status: 400 });
    }
  }

  const messageId = event.data?.email_id;
  if (!HANDLED_EVENTS.has(event.type) || !messageId) {
    console.log(`[resend webhook] ignoring event type=${event.type} id=${messageId ?? "?"}`);
    return NextResponse.json({ ok: true });
  }

  const when = event.created_at ? new Date(event.created_at) : new Date();

  // Look up the send row once — reused across branches that need context.
  const sendRows = (await sql`
    SELECT id, campaign_id, alumni_id, email, subject
    FROM email_sends WHERE resend_message_id = ${messageId} LIMIT 1
  `) as SendRow[];
  const row = sendRows[0];

  if (event.type === "email.sent") {
    await sql`UPDATE email_sends SET status = 'sent', sent_at = COALESCE(sent_at, ${when}) WHERE resend_message_id = ${messageId}`;
  } else if (event.type === "email.delivered") {
    await sql`UPDATE email_sends SET delivered_at = COALESCE(delivered_at, ${when}) WHERE resend_message_id = ${messageId}`;
  } else if (event.type === "email.opened") {
    await sql`UPDATE email_sends SET opened_at = COALESCE(opened_at, ${when}) WHERE resend_message_id = ${messageId}`;
  } else if (event.type === "email.clicked") {
    await sql`UPDATE email_sends SET clicked_at = COALESCE(clicked_at, ${when}) WHERE resend_message_id = ${messageId}`;
    // Also log the specific URL that was clicked so we can see which
    // link the recipient engaged with (not just that they clicked
    // something). Resend puts the URL in event.data.click.link.
    const clickedUrl =
      typeof event.data?.click?.link === "string" && event.data.click.link.trim()
        ? event.data.click.link.trim()
        : null;
    if (clickedUrl) {
      const sends = (await sql`
        SELECT id FROM email_sends WHERE resend_message_id = ${messageId} LIMIT 1
      `) as { id: string }[];
      const sendId = sends[0]?.id;
      if (sendId) {
        await sql`
          INSERT INTO email_clicks (send_id, url, clicked_at)
          VALUES (${sendId}, ${clickedUrl}, ${when})
        `;
      }
    }
  } else if (event.type === "email.bounced") {
    const bounce = event.data?.bounce;
    const type = (bounce?.type ?? "").toLowerCase();
    const isHard = type === "hard" || type === "permanent";
    const bounceType = isHard ? "hard" : "soft";
    const reason = bounce?.message ?? bounce?.subType ?? null;

    await sql`
      UPDATE email_sends SET
        status = 'bounced',
        bounced_at = COALESCE(bounced_at, ${when}),
        bounce_type = ${bounceType},
        bounce_reason = ${reason}
      WHERE resend_message_id = ${messageId}
    `;

    // Hard-bounce quarantine: never send to this alumni again.
    if (isHard && row?.alumni_id != null) {
      await sql`UPDATE alumni SET email_invalid = TRUE WHERE id = ${row.alumni_id}`;
      console.warn(`[resend webhook] hard bounce — alumni ${row.alumni_id} flagged email_invalid`);
    }
  } else if (event.type === "email.complained") {
    await sql`
      UPDATE email_sends SET
        status = 'complained',
        complained_at = COALESCE(complained_at, ${when})
      WHERE resend_message_id = ${messageId}
    `;

    if (row?.alumni_id != null) {
      // Auto-unsubscribe to protect sender reputation.
      await sql`
        UPDATE alumni SET
          subscribed = FALSE,
          unsubscribed_at = COALESCE(unsubscribed_at, ${when}),
          unsubscribe_reason = COALESCE(unsubscribe_reason, 'spam_complaint')
        WHERE id = ${row.alumni_id}
      `;
      await sql`
        INSERT INTO unsubscribe_events (alumni_id, event_type, reason, note)
        VALUES (${row.alumni_id}, 'unsubscribe', 'spam_complaint', 'auto: Resend email.complained webhook')
      `;

      // Alert the admin. Fire-and-forget; failures are logged but don't fail the webhook.
      await notifyAdminOfComplaint({
        alumniId: row.alumni_id,
        email: row.email ?? "(unknown)",
        campaignId: row.campaign_id,
        subject: row.subject ?? "(unknown subject)",
      }).catch((err) => {
        console.error(`[resend webhook] admin notification failed:`, err);
      });

      console.warn(
        `[resend webhook] complaint — alumni ${row.alumni_id} auto-unsubscribed, admin notified`
      );
    }
  }

  console.log(`[resend webhook] applied ${event.type} to message ${messageId}`);
  return NextResponse.json({ ok: true });
}

async function notifyAdminOfComplaint(args: {
  alumniId: number;
  email: string;
  campaignId: string | null;
  subject: string;
}): Promise<void> {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://uwcbayarea.org").replace(/\/+$/, "");
  const body = [
    `A recipient marked a UWC Bay Area email as spam.`,
    "",
    `Alumni #${args.alumniId} (${args.email}) has been auto-unsubscribed and will not receive further emails.`,
    "",
    `Campaign: ${args.subject}`,
    args.campaignId ? `Link: ${appUrl}/admin/email/campaigns/${args.campaignId}` : "",
    args.alumniId ? `Profile: ${appUrl}/admin/alumni/${args.alumniId}` : "",
    "",
    `If you know this person and want to reach out, do it from your personal inbox — they've signaled they don't want broadcast email from us.`,
  ].filter(Boolean).join("\n");

  await Promise.allSettled([
    sendTestEmail({
      to: "manolo@uwcbayarea.org",
      subject: `[UWC Bay Area] Spam complaint: ${args.email}`,
      body,
      salutation: "",
      includeFirstName: false,
    }),
    sendTestEmail({
      to: "manoloe@gmail.com",
      subject: `[UWC Bay Area] Spam complaint: ${args.email}`,
      body,
      salutation: "",
      includeFirstName: false,
    }),
  ]);
}
