import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { getEventBySlug } from "@/lib/events-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  alumni_id?: number | null;
  name?: string | null;
  email?: string | null;
  notes?: string | null;
  is_starred?: boolean;
  needs_followup?: boolean;
  attendee_type?: "comp" | "casual";
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const event = await getEventBySlug(slug);
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as Body;
  const alumniId = body.alumni_id == null ? null : Number(body.alumni_id);
  const name = body.name?.trim() || null;
  const email = body.email?.trim() || null;

  if (!alumniId && !name) {
    return NextResponse.json(
      { error: "Provide either an alumni match or a guest name" },
      { status: 400 }
    );
  }
  if (alumniId !== null && !Number.isFinite(alumniId)) {
    return NextResponse.json({ error: "Invalid alumni_id" }, { status: 400 });
  }

  const attendeeType = body.attendee_type === "casual" ? "casual" : "comp";
  const isCasual = attendeeType === "casual";
  const matchReason = alumniId
    ? isCasual
      ? "Casual attendee — matched to alumni"
      : "Special guest — matched to alumni"
    : isCasual
    ? "Casual attendee — external"
    : "Special guest — external";

  const rows = (await sql`
    INSERT INTO event_attendees (
      event_id, alumni_id, attendee_type,
      stripe_customer_name, stripe_customer_email,
      amount_paid, paid_at,
      match_status, match_confidence, match_reason, matched_at,
      notes, is_starred, needs_followup
    ) VALUES (
      ${event.id}, ${alumniId}, ${attendeeType},
      ${name}, ${email},
      0, NOW(),
      ${alumniId ? "matched" : "unmatched"},
      ${alumniId ? "manual" : null},
      ${matchReason},
      ${alumniId ? new Date().toISOString() : null},
      ${body.notes?.trim() || null},
      ${!!body.is_starred},
      ${!!body.needs_followup}
    )
    RETURNING id
  `) as { id: number }[];

  revalidatePath(`/admin/ticket-events/${slug}/attendees`);
  return NextResponse.json({ ok: true, id: rows[0].id });
}
