import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { rejectPhotos } from "@/lib/event-photos/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = (await request.json().catch(() => null)) as { photoIds?: number[] } | null;
  const ids = Array.isArray(body?.photoIds)
    ? body!.photoIds.map((n) => Number(n)).filter((n) => Number.isFinite(n) && n > 0)
    : [];
  if (ids.length === 0) {
    return NextResponse.json({ error: "photoIds required" }, { status: 400 });
  }
  const count = await rejectPhotos(ids);
  revalidatePath("/preview-home");
  revalidatePath("/photos");
  return NextResponse.json({ ok: true, count });
}
