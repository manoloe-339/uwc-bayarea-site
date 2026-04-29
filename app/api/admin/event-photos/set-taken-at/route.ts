import { NextResponse, type NextRequest } from "next/server";
import { setPhotoTakenAt } from "@/lib/event-photos/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = (await request.json().catch(() => null)) as {
    photoId?: number;
    /** "YYYY-MM-DD" (interpreted as that date at noon UTC), or null to clear. */
    takenAt?: string | null;
  } | null;

  const photoId = Number(body?.photoId);
  if (!Number.isFinite(photoId) || photoId <= 0) {
    return NextResponse.json({ error: "photoId required" }, { status: 400 });
  }

  let takenAt: Date | null = null;
  if (body?.takenAt) {
    const m = String(body.takenAt).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) {
      return NextResponse.json({ error: "takenAt must be YYYY-MM-DD" }, { status: 400 });
    }
    const [, y, mo, d] = m;
    takenAt = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d), 12, 0, 0));
    const year = takenAt.getUTCFullYear();
    if (year < 1990 || year > new Date().getUTCFullYear() + 1) {
      return NextResponse.json({ error: "Date out of plausible range" }, { status: 400 });
    }
  }

  await setPhotoTakenAt(photoId, takenAt);
  return NextResponse.json({
    ok: true,
    takenAt: takenAt ? takenAt.toISOString() : null,
  });
}
