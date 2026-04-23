import { NextResponse, type NextRequest } from "next/server";
import { getEventByCheckinToken, hasValidPinCookie } from "@/lib/checkin";
import { getCheckinStats } from "@/lib/checkin-queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const event = await getEventByCheckinToken(token);
  if (!event) return NextResponse.json({ error: "Invalid token" }, { status: 404 });
  if (!(await hasValidPinCookie(event))) {
    return NextResponse.json({ error: "PIN required" }, { status: 401 });
  }
  const stats = await getCheckinStats(event.id);
  return NextResponse.json(stats);
}
