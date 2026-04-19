import { NextResponse, type NextRequest } from "next/server";
import crypto from "node:crypto";
import { sql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Supported Resend event types we persist.
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

function verifySignature(rawBody: string, header: string | null): boolean {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return true; // TODO: reject when secret is set
  if (!header) return false;

  // Resend uses Svix-style headers when the secret is set (t=timestamp, v1=signature).
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=") as [string, string]));
  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) return false;

  const signed = `${timestamp}.${rawBody}`;
  const expected = crypto.createHmac("sha256", secret).update(signed).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("svix-signature") ?? req.headers.get("resend-signature");
  if (!verifySignature(body, sig)) {
    console.warn("[resend webhook] signature verification failed");
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let event: ResendEvent;
  try {
    event = JSON.parse(body) as ResendEvent;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  if (!process.env.RESEND_WEBHOOK_SECRET) {
    console.warn(
      "[resend webhook] RESEND_WEBHOOK_SECRET not set — accepting event without signature check. Set the secret and re-enable verification."
    );
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

  return NextResponse.json({ ok: true });
}
