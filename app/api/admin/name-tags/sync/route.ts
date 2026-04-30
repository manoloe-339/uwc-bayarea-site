import { NextResponse, type NextRequest } from "next/server";
import { syncNameTagsFromAttendees } from "@/lib/event-name-tags";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = (await request.json().catch(() => null)) as { eventId?: number } | null;
  const eventId = Number(body?.eventId);
  if (!Number.isFinite(eventId) || eventId <= 0) {
    return NextResponse.json({ error: "eventId required" }, { status: 400 });
  }
  const result = await syncNameTagsFromAttendees(eventId);
  return NextResponse.json({ ok: true, ...result });
}
