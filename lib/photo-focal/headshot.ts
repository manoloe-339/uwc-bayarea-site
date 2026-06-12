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
// What fraction of the crop's height the face should occupy. Lower
// values pull more shoulder/background into frame; higher values
// hug the face tighter.
const FACE_HEIGHT_FRACTION = 0.6;

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

/** Compute and upload a head-focused JPEG derivative. Returns the
 *  Blob URL. Idempotent on the alumni id — overwrites the prior
 *  headshot for the same alum. */
export async function bakeHeadshot(
  buf: Buffer,
  face: FaceBox,
  alumniId: number,
): Promise<string> {
  // Choose a crop height such that the face occupies ~60% of it.
  // If the source image is too short to give us that much room, fall
  // back to the source height.
  let cropH = Math.round(face.pixelH / FACE_HEIGHT_FRACTION);
  cropH = Math.min(cropH, face.imgH);
  let cropW = Math.round(cropH * TARGET_ASPECT);
  // If our target width overflows the source, scale both axes down
  // so the crop fits.
  if (cropW > face.imgW) {
    const scale = face.imgW / cropW;
    cropW = face.imgW;
    cropH = Math.round(cropH * scale);
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
    // Cap the longest edge at 720 — the band displays at ~360 px
    // wide, so 2x retina is plenty. Keeps blob sizes small.
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
