import { NextResponse, type NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getEventByCheckinToken, hasValidPinCookie } from "@/lib/checkin";
import { getAttendeeForCheckin } from "@/lib/checkin-queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  name?: string;
  email?: string | null;
  college?: string | null;
  relationship_type?: string | null;
  associated_with_alumni_id?: number | null;
  /** When admin picked an alum from the Name field's autocomplete,
   * this is that alum's id. Walk-in is created linked to that record. */
  matched_alumni_id?: number | null;
  notes?: string | null;
};

const ALLOWED_RELATIONSHIPS = new Set([
  "spouse_partner",
  "friend",
  "colleague",
  "family",
  "plus_one",
  "uwc_alum_in_database",
  "uwc_alum_not_in_db",
  "other",
]);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const event = await getEventByCheckinToken(token);
  if (!event) return NextResponse.json({ error: "Invalid token" }, { status: 404 });
  if (!(await hasValidPinCookie(event))) {
    return NextResponse.json({ error: "PIN required" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as Body;
  const name = (body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  const relationship =
    body.relationship_type == null ? null : String(body.relationship_type).trim();
  if (relationship !== null && !ALLOWED_RELATIONSHIPS.has(relationship)) {
    return NextResponse.json({ error: "Invalid relationship_type" }, { status: 400 });
  }
  const assoc =
    body.associated_with_alumni_id == null ? null : Number(body.associated_with_alumni_id);
  if (assoc !== null && !Number.isFinite(assoc)) {
    return NextResponse.json({ error: "Invalid associated_with_alumni_id" }, { status: 400 });
  }
  const matchedAlumId =
    body.matched_alumni_id == null ? null : Number(body.matched_alumni_id);
  if (matchedAlumId !== null && !Number.isFinite(matchedAlumId)) {
    return NextResponse.json({ error: "Invalid matched_alumni_id" }, { status: 400 });
  }

  const collegeNote = body.college?.trim() || null;
  const combinedNotes = [body.notes?.trim(), collegeNote ? `College: ${collegeNote}` : null]
    .filter(Boolean)
    .join(" · ") || null;

  // When the admin picked an alum from the Name field's autocomplete,
  // create the row linked to that alumni record (matched, not unmatched).
  // Otherwise it's a free-text walk-in row to triage later.
  const matchStatus = matchedAlumId ? "matched" : "unmatched";
  const matchConfidence = matchedAlumId ? "manual" : null;
  const matchReason = matchedAlumId
    ? "Walk-in: admin picked alum at check-in"
    : "Walk-in added at check-in";
  const needsFollowup = matchedAlumId ? false : true;

  const rows = (await sql`
    INSERT INTO event_attendees (
      event_id, attendee_type, alumni_id,
      stripe_customer_name, stripe_customer_email,
      amount_paid, paid_at,
      match_status, match_confidence, match_reason, matched_at,
      checked_in, checked_in_at, checked_in_by,
      associated_with_alumni_id, relationship_type,
      notes, needs_followup
    ) VALUES (
      ${event.id}, 'walk-in', ${matchedAlumId},
      ${name}, ${body.email?.trim() || null},
      0, NOW(),
      ${matchStatus}, ${matchConfidence}, ${matchReason},
      ${matchedAlumId ? new Date().toISOString() : null},
      TRUE, NOW(), ${event.checkin_token},
      ${assoc}, ${relationship},
      ${combinedNotes}, ${needsFollowup}
    )
    RETURNING id
  `) as { id: number }[];

  const hit = await getAttendeeForCheckin(rows[0].id, event.id);
  return NextResponse.json({ ok: true, hit });
}
