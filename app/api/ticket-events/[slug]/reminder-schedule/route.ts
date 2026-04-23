import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { getEventBySlug } from "@/lib/events-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  // ISO-8601 timestamp, or null to cancel.
  scheduled_at?: string | null;
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const event = await getEventBySlug(slug);
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as Body;
  const raw = body.scheduled_at;
  let sendAt: string | null = null;
  if (raw != null && raw !== "") {
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) {
      return NextResponse.json({ error: "Invalid date" }, { status: 400 });
    }
    sendAt = d.toISOString();
  }

  // Setting a new (or cleared) schedule always resets the
  // reminder_auto_sent_at sentinel so the cron can fire again. If you
  // clear then re-schedule, we send on the new date.
  await sql`
    UPDATE events
    SET reminder_scheduled_at = ${sendAt},
        reminder_auto_sent_at = NULL,
        updated_at = NOW()
    WHERE id = ${event.id}
  `;
  revalidatePath(`/admin/ticket-events/${slug}/communications`);
  return NextResponse.json({ ok: true, scheduled_at: sendAt });
}
