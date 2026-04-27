import { NextResponse, type NextRequest } from "next/server";
import { setUploadEnabled } from "@/lib/event-photos/queries";
import { sql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = (await request.json().catch(() => null)) as { eventId?: number; enabled?: boolean } | null;
  const eventId = Number(body?.eventId);
  const enabled = !!body?.enabled;
  if (!Number.isFinite(eventId) || eventId <= 0) {
    return NextResponse.json({ error: "eventId required" }, { status: 400 });
  }
  const exists = (await sql`SELECT id FROM events WHERE id = ${eventId} LIMIT 1`) as { id: number }[];
  if (exists.length === 0) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }
  await setUploadEnabled(eventId, enabled);
  return NextResponse.json({ ok: true, enabled });
}
