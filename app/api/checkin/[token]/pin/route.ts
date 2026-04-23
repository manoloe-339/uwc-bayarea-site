import { NextResponse, type NextRequest } from "next/server";
import { getEventByCheckinToken, setPinCookie } from "@/lib/checkin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const event = await getEventByCheckinToken(token);
  if (!event || !event.checkin_token) {
    return NextResponse.json({ error: "Invalid token" }, { status: 404 });
  }
  if (!event.checkin_pin) {
    // No PIN configured — nothing to authenticate.
    return NextResponse.json({ ok: true });
  }
  const { pin } = (await req.json().catch(() => ({}))) as { pin?: string };
  const normalized = (pin ?? "").trim();
  if (normalized !== event.checkin_pin) {
    return NextResponse.json({ error: "Wrong PIN" }, { status: 401 });
  }
  await setPinCookie(event);
  return NextResponse.json({ ok: true });
}
