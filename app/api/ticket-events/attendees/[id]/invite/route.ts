import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { sendSignupInvite } from "@/lib/email-send";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  subject?: string;
  body?: string;
  to?: string;
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const rows = (await sql`
    SELECT a.stripe_customer_email, e.slug
    FROM event_attendees a
    JOIN events e ON e.id = a.event_id
    WHERE a.id = ${id}
    LIMIT 1
  `) as { stripe_customer_email: string | null; slug: string }[];
  const attendee = rows[0];
  if (!attendee) {
    return NextResponse.json({ error: "Attendee not found" }, { status: 404 });
  }

  const { subject = "", body = "", to: toOverride } = (await req.json().catch(() => ({}))) as Body;
  const to = (toOverride ?? attendee.stripe_customer_email ?? "").trim();
  if (!to || !to.includes("@")) {
    return NextResponse.json({ error: "No valid recipient email" }, { status: 400 });
  }
  if (!subject.trim() || !body.trim()) {
    return NextResponse.json({ error: "Subject and body are required" }, { status: 400 });
  }

  const result = await sendSignupInvite({
    attendeeId: id,
    to,
    subject: subject.trim(),
    body: body.trim(),
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  revalidatePath(`/admin/ticket-events/${attendee.slug}/attendees`);
  return NextResponse.json({ ok: true, id: result.id });
}
