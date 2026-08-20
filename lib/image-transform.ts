/**
 * Wrap Vercel Blob URLs in the Next.js Image Optimization proxy so
 * email recipients download a compressed, appropriately-sized JPEG
 * instead of the original upload (which averages 2.4 MB at 3786×3381).
 *
 * At q=75, a 640×480 JPEG derived from a ~10 MP source is ~40-60 KB —
 * safely under Gmail's 102 KB body-clip threshold when multiplied
 * across a few images per newsletter.
 *
 * The endpoint (/_next/image) is a Next.js built-in; the source host
 * (*.public.blob.vercel-storage.com) is already whitelisted in
 * next.config.mjs remotePatterns.
 *
 * `w` must be one of Next's configured deviceSizes / imageSizes.
 * Defaults include 384 (thumbnails) and 640 (hero). Both are used
 * here.
 */

const HERO_WIDTH = 640; // 2x for a 320px display in retina, safe for 600px email frame
const THUMB_WIDTH = 384; // 2x for a ~150–192px thumbnail

function appBase(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") ||
    "https://uwcbayarea.org"
  );
}

/** Wrap a Blob URL in Next's optimizer. Non-Blob URLs (external
 *  images, the UWC logo, whatever) pass through unchanged so we
 *  don't accidentally break hotlinks we don't control.
 *
 *  `targetDisplayWidth` — the width the img tag will render at.
 *  Pass null for full-width (hero) images. Under ~300 uses the
 *  thumbnail size; above uses the hero size. */
export function emailOptimizedImageUrl(
  src: string,
  targetDisplayWidth: number | null,
): string {
  if (!src) return src;
  if (!/\.public\.blob\.vercel-storage\.com/.test(src)) return src;
  // Skip if already optimized (idempotent).
  if (src.includes("/_next/image")) return src;
  const w = targetDisplayWidth != null && targetDisplayWidth <= 300
    ? THUMB_WIDTH
    : HERO_WIDTH;
  return `${appBase()}/_next/image?url=${encodeURIComponent(src)}&w=${w}&q=75`;
}

/**
 * Return a URL that resolves to a pre-cropped SQUARE JPEG. Used
 * by the newsletter photo grid so Gmail can render squares
 * without CSS aspect tricks (which break in the Gmail app).
 *
 * Crop values are percentages 0–100 of the source image. Pass
 * null crop to get a center-cover square of the whole source.
 */
export function squareCropImageUrl(
  src: string,
  crop: { x: number; y: number; w: number; h: number } | null,
  sizePx = 520,
): string {
  if (!src) return src;
  if (!/\.public\.blob\.vercel-storage\.com/.test(src)) return src;
  const c = crop ?? { x: 0, y: 0, w: 100, h: 100 };
  const q = new URLSearchParams({
    url: src,
    x: String(c.x),
    y: String(c.y),
    w: String(c.w),
    h: String(c.h),
    size: String(sizePx),
    // Bump `v` whenever the crop endpoint changes how it derives
    // output pixels (e.g. added EXIF rotation) — the response is
    // cached immutable, so identical URLs keep serving stale data
    // until the URL itself changes.
    v: "2",
  });
  return `${appBase()}/api/img-crop?${q.toString()}`;
}
