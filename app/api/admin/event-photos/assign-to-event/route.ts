import { NextResponse, type NextRequest } from "next/server";
import { assignPhotoToEvent } from "@/lib/event-photos/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = (await request.json().catch(() => null)) as {
    photoId?: number;
    eventId?: number;
  } | null;

  const photoId = Number(body?.photoId);
  const eventId = Number(body?.eventId);
  if (!Number.isFinite(photoId) || photoId <= 0) {
    return NextResponse.json({ error: "photoId required" }, { status: 400 });
  }
  if (!Number.isFinite(eventId) || eventId <= 0) {
    return NextResponse.json({ error: "eventId required" }, { status: 400 });
  }

  const result = await assignPhotoToEvent(photoId, eventId);
  if (!result) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }
  return NextResponse.json({
    ok: true,
    event: {
      slug: result.slug,
      name: result.name,
      date: result.date instanceof Date ? result.date.toISOString() : result.date,
    },
  });
}
