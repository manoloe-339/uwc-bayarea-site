/**
 * Per-photo crop rectangle storage for newsletter cells. Admin picks
 * a square region via react-easy-crop → we save the region as
 * percentages of the source. Renderer scales+positions the image
 * inside the cell so ONLY that region is visible.
 *
 * Legacy focal_x/y columns are still read for photos adjusted before
 * the crop-rectangle schema (2026-08-20 migration 108).
 */
import { sql } from "@/lib/db";

export type PhotoCrop = {
  photo_id: number;
  event_id: number;
  blob_url: string;
  /** Crop rectangle (source-percent). Null when never adjusted. */
  crop_x: number | null;
  crop_y: number | null;
  crop_w: number | null;
  crop_h: number | null;
};

export async function lookupCropsForUrls(urls: string[]): Promise<PhotoCrop[]> {
  if (urls.length === 0) return [];
  const rows = (await sql`
    SELECT id AS photo_id, event_id, blob_url,
           crop_x, crop_y, crop_w, crop_h
    FROM event_photos
    WHERE blob_url = ANY(${urls})
  `) as Array<{
    photo_id: number;
    event_id: number;
    blob_url: string;
    crop_x: string | number | null;
    crop_y: string | number | null;
    crop_w: string | number | null;
    crop_h: string | number | null;
  }>;
  const n = (v: string | number | null) => (v != null ? Number(v) : null);
  return rows.map((r) => ({
    photo_id: r.photo_id,
    event_id: r.event_id,
    blob_url: r.blob_url,
    crop_x: n(r.crop_x),
    crop_y: n(r.crop_y),
    crop_w: n(r.crop_w),
    crop_h: n(r.crop_h),
  }));
}

/** Persist a crop rectangle for one photo (by id). All values are
 *  0–100 percentages of the source dimensions. */
export async function savePhotoCrop(
  photoId: number,
  cropX: number,
  cropY: number,
  cropW: number,
  cropH: number,
): Promise<void> {
  const clamp = (n: number) => Math.max(0, Math.min(100, n));
  await sql`
    UPDATE event_photos
    SET crop_x = ${clamp(cropX)},
        crop_y = ${clamp(cropY)},
        crop_w = ${clamp(cropW)},
        crop_h = ${clamp(cropH)}
    WHERE id = ${photoId}
  `;
}
