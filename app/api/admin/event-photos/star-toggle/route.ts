import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { toggleStarMarquee } from "@/lib/event-photos/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = (await request.json().catch(() => null)) as { photoId?: number } | null;
  const photoId = Number(body?.photoId);
  if (!Number.isFinite(photoId) || photoId <= 0) {
    return NextResponse.json({ error: "photoId required" }, { status: 400 });
  }
  const updated = await toggleStarMarquee(photoId);
  if (!updated) {
    return NextResponse.json({ error: "Photo not found" }, { status: 404 });
  }
  revalidatePath("/preview-home");
  revalidatePath("/photos");
  return NextResponse.json({
    ok: true,
    photo: {
      id: updated.id,
      approval_status: updated.approval_status,
      display_role: updated.display_role,
    },
  });
}
