import { NextResponse, type NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { getEventByCheckinToken, hasValidPinCookie } from "@/lib/checkin";
import { getAttendeeForCheckin } from "@/lib/checkin-queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { attendee_id: number; undo?: boolean };

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
  const id = Number(body.attendee_id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Invalid attendee id" }, { status: 400 });
  }
  const current = await getAttendeeForCheckin(id, event.id);
  if (!current) return NextResponse.json({ error: "Attendee not found" }, { status: 404 });

  if (body.undo) {
    await sql`
      UPDATE event_attendees
      SET checked_in = FALSE, checked_in_at = NULL, checked_in_by = NULL, updated_at = NOW()
      WHERE id = ${id}
    `;
    return NextResponse.json({ ok: true, undone: true });
  }

  if (current.refund_status === "refunded") {
    return NextResponse.json(
      { error: "refunded", message: "This ticket was refunded." },
      { status: 409 }
    );
  }
  if (current.checked_in) {
    return NextResponse.json(
      {
        error: "already_checked_in",
        message: "Already checked in",
        checked_in_at: current.checked_in_at,
      },
      { status: 409 }
    );
  }
  await sql`
    UPDATE event_attendees
    SET checked_in = TRUE, checked_in_at = NOW(), checked_in_by = ${event.checkin_token},
        updated_at = NOW()
    WHERE id = ${id}
  `;
  return NextResponse.json({ ok: true });
}
