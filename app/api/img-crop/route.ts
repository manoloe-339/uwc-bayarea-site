/**
 * Server-side image crop for the newsletter grid. Returns a
 * pre-cropped square JPEG so the email HTML can use plain
 * `<img width="X" height="X" style="width:100%; height:auto">`
 * without any Gmail-incompatible CSS tricks (position:absolute
 * + padding-top:100% breaks in the Gmail iOS/Android app,
 * leaving grey boxes around the photos).
 *
 * Inputs are percentages 0-100 (matching how the AdjustPhotos
 * modal saves them). URL params:
 *   url — the source blob URL (must be a Vercel Blob)
 *   x, y, w, h — crop rectangle in % of source dimensions
 *   size — output square edge in pixels (default 520)
 *
 * Response is a JPEG with immutable cache — since the URL
 * uniquely identifies the crop, browsers/proxies can cache
 * forever. That's what makes this cheap in practice.
 */
import { NextRequest } from "next/server";
import sharp from "sharp";

export const runtime = "nodejs";
// Long revalidate lets Vercel's edge cache the response.
export const revalidate = 31536000;

function parseNum(v: string | null, fallback: number, min: number, max: number): number {
  if (v == null) return fallback;
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url || !/\.public\.blob\.vercel-storage\.com/.test(url)) {
    return new Response("bad url", { status: 400 });
  }
  const x = parseNum(req.nextUrl.searchParams.get("x"), 0, 0, 100);
  const y = parseNum(req.nextUrl.searchParams.get("y"), 0, 0, 100);
  const w = parseNum(req.nextUrl.searchParams.get("w"), 100, 1, 100);
  const h = parseNum(req.nextUrl.searchParams.get("h"), 100, 1, 100);
  const size = Math.round(parseNum(req.nextUrl.searchParams.get("size"), 520, 64, 1200));

  const upstream = await fetch(url, { cache: "force-cache" });
  if (!upstream.ok) {
    return new Response("upstream fetch failed", { status: 502 });
  }
  const buf = Buffer.from(await upstream.arrayBuffer());

  const meta = await sharp(buf).metadata();
  const srcW = meta.width ?? 0;
  const srcH = meta.height ?? 0;
  if (!srcW || !srcH) return new Response("bad image", { status: 502 });

  // Convert crop % → pixel rectangle on the source. Clamp to
  // source bounds so a slightly-out-of-range crop rectangle
  // still produces a valid extract.
  const px = Math.max(0, Math.min(srcW - 1, Math.round((x / 100) * srcW)));
  const py = Math.max(0, Math.min(srcH - 1, Math.round((y / 100) * srcH)));
  const pw = Math.max(1, Math.min(srcW - px, Math.round((w / 100) * srcW)));
  const ph = Math.max(1, Math.min(srcH - py, Math.round((h / 100) * srcH)));

  const out = await sharp(buf)
    .extract({ left: px, top: py, width: pw, height: ph })
    .resize(size, size, { fit: "cover" })
    .jpeg({ quality: 78, mozjpeg: true })
    .toBuffer();

  return new Response(new Uint8Array(out), {
    status: 200,
    headers: {
      "content-type": "image/jpeg",
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}
