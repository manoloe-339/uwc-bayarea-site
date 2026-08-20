/**
 * Focal-point storage for event photos, used by the newsletter
 * "Adjust photographs" flow. Focal is stored per-photo (event_photos
 * table) so an admin only ever re-centers a given photo once.
 */
import { sql } from "@/lib/db";

export type PhotoFocal = {
  photo_id: number;
  event_id: number;
  blob_url: string;
  focal_x: number | null;
  focal_y: number | null;
};

/** Given a set of image URLs, return the ones that match rows in
 *  event_photos, with their focal points (nulls if never set).
 *  Non-matching URLs (external images, Claude-inserted URLs pointing
 *  elsewhere) are simply omitted from the result. */
export async function lookupFocalsForUrls(urls: string[]): Promise<PhotoFocal[]> {
  if (urls.length === 0) return [];
  const rows = (await sql`
    SELECT id AS photo_id, event_id, blob_url, focal_x, focal_y
    FROM event_photos
    WHERE blob_url = ANY(${urls})
  `) as Array<{
    photo_id: number;
    event_id: number;
    blob_url: string;
    focal_x: string | number | null;
    focal_y: string | number | null;
  }>;
  return rows.map((r) => ({
    photo_id: r.photo_id,
    event_id: r.event_id,
    blob_url: r.blob_url,
    // Numeric columns come back as strings from the pg client sometimes.
    focal_x: r.focal_x != null ? Number(r.focal_x) : null,
    focal_y: r.focal_y != null ? Number(r.focal_y) : null,
  }));
}

/** Persist a focal point for one photo (by id). Clamps to [0, 100]. */
export async function savePhotoFocal(
  photoId: number,
  focalX: number,
  focalY: number,
): Promise<void> {
  const x = Math.max(0, Math.min(100, focalX));
  const y = Math.max(0, Math.min(100, focalY));
  await sql`
    UPDATE event_photos
    SET focal_x = ${x}, focal_y = ${y}
    WHERE id = ${photoId}
  `;
}
