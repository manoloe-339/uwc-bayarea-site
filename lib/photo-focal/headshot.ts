/**
 * Bake a head-focused derivative of an alum's photo. The shortlist's
 * 220 px tall wide band can't fit a small face inside its aspect via
 * object-position alone — so we ship a tightly-cropped copy with the
 * face already filling most of the frame, uploaded once during
 * focal-point detection.
 *
 * The crop is computed from the detected face box: we target a
 * landscape rectangle (1.64:1, matching the shortlist photo band)
 * where the face occupies ~60% of the height. Out-of-bounds is
 * clamped to the source so the crop stays inside the original image.
 */
import { put } from "@vercel/blob";
import sharp from "sharp";
import type { FaceBox } from "./detect";

const HEADSHOT_PREFIX = "alumni-headshots/";
// Mirror the shortlist photo band's aspect (~360x220).
const TARGET_ASPECT = 360 / 220;

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

/** Compute and upload a head-focused JPEG derivative. NO PIXEL ZOOM —
 *  we take the largest 1.64:1 slice that fits in the source image at
 *  its natural scale, then slide it so the detected face center
 *  lands in the middle, clamped to bounds. Photos with a small face
 *  surrounded by background stay small (don't get pixel-zoomed); the
 *  only intent is to guarantee the face is in the visible band. */
export async function bakeHeadshot(
  buf: Buffer,
  face: FaceBox,
  alumniId: number,
): Promise<string> {
  // Largest letterbox at the target aspect that fits inside the
  // source. If the source is more landscape than the target, height
  // is the limit; otherwise width is the limit.
  let cropW: number;
  let cropH: number;
  if (face.imgW / face.imgH <= TARGET_ASPECT) {
    cropW = face.imgW;
    cropH = Math.round(cropW / TARGET_ASPECT);
  } else {
    cropH = face.imgH;
    cropW = Math.round(cropH * TARGET_ASPECT);
  }

  // Center the crop on the focal point (face center + slight upward
  // bias), then clamp to source bounds so we don't run off the edge.
  const cx = face.pixelX + face.pixelW / 2;
  const cy = face.pixelY + face.pixelH * 0.45;
  const left = clamp(Math.round(cx - cropW / 2), 0, face.imgW - cropW);
  const top = clamp(Math.round(cy - cropH / 2), 0, face.imgH - cropH);

  const out = await sharp(buf)
    .rotate() // honour EXIF
    .extract({ left, top, width: cropW, height: cropH })
    // Cap longest edge at 720 so retina has 2x at the ~360 px band
    // without bloating Blob storage.
    .resize({ width: 720, withoutEnlargement: true })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();

  const key = `${HEADSHOT_PREFIX}${alumniId}.jpg`;
  const uploaded = await put(key, out, {
    access: "public",
    allowOverwrite: true,
    contentType: "image/jpeg",
  });
  return uploaded.url;
}
