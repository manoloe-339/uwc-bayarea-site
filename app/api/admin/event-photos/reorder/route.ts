import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { reorderPhotos } from "@/lib/event-photos/queries";
import type { DisplayRole } from "@/lib/event-photos/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_ROLES: DisplayRole[] = ["marquee", "supporting"];

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = (await request.json().catch(() => null)) as {
    eventId?: number;
    role?: string;
    photoIds?: number[];
  } | null;

  const eventId = Number(body?.eventId);
  if (!Number.isFinite(eventId) || eventId <= 0) {
    return NextResponse.json({ error: "eventId required" }, { status: 400 });
  }

  if (!VALID_ROLES.includes(body?.role as DisplayRole)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const ids = Array.isArray(body?.photoIds)
    ? body!.photoIds.map((n) => Number(n)).filter((n) => Number.isFinite(n) && n > 0)
    : [];

  await reorderPhotos(eventId, body!.role as DisplayRole, ids);
  revalidatePath("/");
  revalidatePath("/photos");
  return NextResponse.json({ ok: true, count: ids.length });
}
