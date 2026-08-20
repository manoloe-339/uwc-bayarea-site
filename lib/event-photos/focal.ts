/**
 * Newsletter-scoped photo crop rectangles. Stored in the dedicated
 * `newsletter_photo_crops` table (see migration 109) — deliberately
 * NOT on event_photos so a newsletter square crop can never bleed
 * into the gallery view, which keeps photos at their natural aspect.
 *
 * Admin adjusts a crop from the newsletter compose page's "Adjust
 * photographs" modal. Values are 0-100 percentages of the source.
 */
import { sql } from "@/lib/db";

export type PhotoCrop = {
  photo_id: number;
  event_id: number;
  event_slug: string;
  event_name: string;
  blob_url: string;
  crop_x: number | null;
  crop_y: number | null;
  crop_w: number | null;
  crop_h: number | null;
};

export async function lookupCropsForUrls(urls: string[]): Promise<PhotoCrop[]> {
  if (urls.length === 0) return [];
  const rows = (await sql`
    SELECT ep.id AS photo_id, ep.event_id, ep.blob_url,
           e.slug AS event_slug, e.name AS event_name,
           npc.crop_x, npc.crop_y, npc.crop_w, npc.crop_h
    FROM event_photos ep
    JOIN events e ON e.id = ep.event_id
    LEFT JOIN newsletter_photo_crops npc ON npc.photo_id = ep.id
    WHERE ep.blob_url = ANY(${urls})
  `) as Array<{
    photo_id: number;
    event_id: number;
    event_slug: string;
    event_name: string;
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
    event_slug: r.event_slug,
    event_name: r.event_name,
    blob_url: r.blob_url,
    crop_x: n(r.crop_x),
    crop_y: n(r.crop_y),
    crop_w: n(r.crop_w),
    crop_h: n(r.crop_h),
  }));
}

/** Upsert a newsletter-scoped crop rectangle. */
export async function savePhotoCrop(
  photoId: number,
  cropX: number,
  cropY: number,
  cropW: number,
  cropH: number,
): Promise<void> {
  const clamp = (n: number) => Math.max(0, Math.min(100, n));
  await sql`
    INSERT INTO newsletter_photo_crops (photo_id, crop_x, crop_y, crop_w, crop_h, updated_at)
    VALUES (
      ${photoId}, ${clamp(cropX)}, ${clamp(cropY)}, ${clamp(cropW)}, ${clamp(cropH)}, NOW()
    )
    ON CONFLICT (photo_id) DO UPDATE
      SET crop_x = EXCLUDED.crop_x,
          crop_y = EXCLUDED.crop_y,
          crop_w = EXCLUDED.crop_w,
          crop_h = EXCLUDED.crop_h,
          updated_at = NOW()
  `;
}
