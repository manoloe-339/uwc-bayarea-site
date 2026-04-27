import { NextResponse, type NextRequest } from "next/server";
import { setPhotoLayout } from "@/lib/event-photos/queries";
import type { DisplayRole } from "@/lib/event-photos/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_ROLES: DisplayRole[] = ["marquee", "supporting"];

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = (await request.json().catch(() => null)) as {
    photoId?: number;
    displayRole?: string | null;
    displayOrder?: number | null;
  } | null;

  const photoId = Number(body?.photoId);
  if (!Number.isFinite(photoId) || photoId <= 0) {
    return NextResponse.json({ error: "photoId required" }, { status: 400 });
  }

  let role: DisplayRole | null = null;
  if (body?.displayRole != null) {
    if (!VALID_ROLES.includes(body.displayRole as DisplayRole)) {
      return NextResponse.json({ error: "Invalid displayRole" }, { status: 400 });
    }
    role = body.displayRole as DisplayRole;
  }

  let order: number | null = null;
  if (body?.displayOrder != null) {
    const n = Number(body.displayOrder);
    if (!Number.isFinite(n) || n < 0) {
      return NextResponse.json({ error: "Invalid displayOrder" }, { status: 400 });
    }
    order = Math.floor(n);
  }

  await setPhotoLayout(photoId, role, order);
  return NextResponse.json({ ok: true });
}
