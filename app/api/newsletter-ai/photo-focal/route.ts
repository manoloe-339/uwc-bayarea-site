import { NextResponse, type NextRequest } from "next/server";
import { lookupCropsForUrls, savePhotoCrop } from "@/lib/event-photos/focal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/newsletter-ai/photo-focal?url=<u1>&url=<u2>
 *  Returns crops for URLs matching event_photos rows.
 *
 *  POST { photo_id, crop_x, crop_y, crop_w, crop_h } → saves. */
export async function GET(req: NextRequest) {
  const urls = req.nextUrl.searchParams.getAll("url");
  const crops = await lookupCropsForUrls(urls);
  // Legacy field name kept in the response so clients that speak the
  // old "focals" shape don't break — includes both.
  return NextResponse.json({
    crops,
    focals: crops, // alias
  });
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as {
    photo_id?: number;
    crop_x?: number;
    crop_y?: number;
    crop_w?: number;
    crop_h?: number;
  } | null;
  if (
    !body?.photo_id ||
    body.crop_x == null ||
    body.crop_y == null ||
    body.crop_w == null ||
    body.crop_h == null
  ) {
    return NextResponse.json(
      { error: "photo_id + crop_x + crop_y + crop_w + crop_h required" },
      { status: 400 },
    );
  }
  await savePhotoCrop(
    Number(body.photo_id),
    Number(body.crop_x),
    Number(body.crop_y),
    Number(body.crop_w),
    Number(body.crop_h),
  );
  return NextResponse.json({ ok: true });
}
