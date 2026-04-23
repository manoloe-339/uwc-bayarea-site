import { NextResponse, type NextRequest } from "next/server";
import { getEventByCheckinToken, hasValidPinCookie } from "@/lib/checkin";
import { verifyQRToken } from "@/lib/qr-code";
import { getAttendeeForCheckin } from "@/lib/checkin-queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { qr: string };

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
  const v = verifyQRToken(body.qr ?? "");
  if (!v.valid) {
    return NextResponse.json({ error: "invalid_qr", reason: v.reason }, { status: 400 });
  }
  if (v.eventId !== event.id) {
    return NextResponse.json({ error: "wrong_event" }, { status: 400 });
  }
  const hit = await getAttendeeForCheckin(v.attendeeId, event.id);
  if (!hit) {
    return NextResponse.json({ error: "attendee_not_found" }, { status: 404 });
  }
  return NextResponse.json({ hit });
}
