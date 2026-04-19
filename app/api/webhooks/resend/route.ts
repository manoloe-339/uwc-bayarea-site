import { NextResponse, type NextRequest } from "next/server";
import { Webhook } from "svix";
import { sql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HANDLED_EVENTS = new Set([
  "email.delivered",
  "email.opened",
  "email.clicked",
  "email.bounced",
  "email.complained",
]);

type ResendEvent = {
  type: string;
  created_at?: string;
  data?: {
    email_id?: string;
    to?: string | string[];
  };
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

  if (event.type === "email.delivered") {
    await sql`UPDATE email_sends SET status = 'sent', sent_at = COALESCE(sent_at, ${when}) WHERE resend_message_id = ${messageId}`;
  } else if (event.type === "email.opened") {
    await sql`UPDATE email_sends SET opened_at = COALESCE(opened_at, ${when}) WHERE resend_message_id = ${messageId}`;
  } else if (event.type === "email.clicked") {
    await sql`UPDATE email_sends SET clicked_at = COALESCE(clicked_at, ${when}) WHERE resend_message_id = ${messageId}`;
  } else if (event.type === "email.bounced") {
    await sql`UPDATE email_sends SET status = 'bounced', bounced_at = COALESCE(bounced_at, ${when}) WHERE resend_message_id = ${messageId}`;
  } else if (event.type === "email.complained") {
    await sql`UPDATE email_sends SET status = 'complained' WHERE resend_message_id = ${messageId}`;
  }

  console.log(`[resend webhook] applied ${event.type} to message ${messageId}`);
  return NextResponse.json({ ok: true });
}
