import { NextResponse, type NextRequest } from "next/server";
import { del } from "@vercel/blob";
import { deletePhotosFromDb } from "@/lib/event-photos/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = (await request.json().catch(() => null)) as { photoIds?: number[] } | null;
  const ids = Array.isArray(body?.photoIds)
    ? body!.photoIds.map((n) => Number(n)).filter((n) => Number.isFinite(n) && n > 0)
    : [];
  if (ids.length === 0) {
    return NextResponse.json({ error: "photoIds required" }, { status: 400 });
  }

  const removed = await deletePhotosFromDb(ids);

  await Promise.all(
    removed.map(async (p) => {
      try {
        await del(p.blob_url);
      } catch {
        // best-effort: blob may already be gone
      }
    })
  );

  return NextResponse.json({ ok: true, count: removed.length });
}
