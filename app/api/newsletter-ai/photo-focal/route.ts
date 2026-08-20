import { NextResponse, type NextRequest } from "next/server";
import { lookupFocalsForUrls, savePhotoFocal } from "@/lib/event-photos/focal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/newsletter-ai/photo-focal?url=<u1>&url=<u2>...
 *  Returns focals for the URLs that match event_photos rows.
 *
 *  POST { photo_id, focal_x, focal_y } → saves. */
export async function GET(req: NextRequest) {
  const urls = req.nextUrl.searchParams.getAll("url");
  const focals = await lookupFocalsForUrls(urls);
  return NextResponse.json({ focals });
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as {
    photo_id?: number;
    focal_x?: number;
    focal_y?: number;
  } | null;
  if (!body?.photo_id || body.focal_x == null || body.focal_y == null) {
    return NextResponse.json(
      { error: "photo_id, focal_x, focal_y required" },
      { status: 400 },
    );
  }
  await savePhotoFocal(Number(body.photo_id), Number(body.focal_x), Number(body.focal_y));
  return NextResponse.json({ ok: true });
}
