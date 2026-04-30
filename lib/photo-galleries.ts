import { sql } from "./db";

export interface GalleryThumb {
  id: number;
  url: string;
  alt: string;
  width: number | null;
  height: number | null;
}

export interface GalleryRow {
  eventId: number;
  slug: string;
  title: string;
  date: Date;
  location: string | null;
  photoCount: number;
  thumbs: GalleryThumb[];
}

export interface MarqueePhoto {
  id: number;
  url: string;
  alt: string;
  width: number | null;
  height: number | null;
}

type GalleryRowSqlRow = {
  event_id: number;
  slug: string;
  name: string;
  date: Date;
  location: string | null;
  photo_id: number;
  blob_url: string;
  original_filename: string | null;
  photo_width: number | null;
  photo_height: number | null;
  total_count: number;
  rn: number;
};

/**
 * Returns one row per (event, photo) for the public Photos page.
 * Each event with ≥1 approved photo contributes up to `thumbsPerRow` photos,
 * with marquee-tagged photos first, then supporting/untagged.
 */
export async function getPublicGalleryRows(thumbsPerRow: number): Promise<GalleryRow[]> {
  const rows = (await sql`
    WITH deduped AS (
      SELECT
        ep.*,
        CASE
          WHEN ep.original_filename IS NULL OR ep.original_filename = '' THEN 1
          ELSE ROW_NUMBER() OVER (
            PARTITION BY ep.event_id, ep.original_filename
            ORDER BY ep.uploaded_at ASC, ep.id ASC
          )
        END AS dup_rn
      FROM event_photos ep
      WHERE ep.approval_status = 'approved'
    ),
    ranked AS (
      SELECT
        d.id            AS photo_id,
        d.event_id,
        d.blob_url,
        d.original_filename,
        d.width         AS photo_width,
        d.height        AS photo_height,
        ROW_NUMBER() OVER (
          PARTITION BY d.event_id
          ORDER BY
            CASE WHEN d.display_role = 'marquee' THEN 0 ELSE 1 END,
            d.display_order ASC NULLS LAST,
            COALESCE(d.taken_at, d.uploaded_at) DESC,
            d.id DESC
        ) AS rn,
        COUNT(*) OVER (PARTITION BY d.event_id)::int AS total_count
      FROM deduped d
      WHERE d.dup_rn = 1
    )
    SELECT
      e.id            AS event_id,
      e.slug,
      e.name,
      e.date,
      e.location,
      r.photo_id,
      r.blob_url,
      r.original_filename,
      r.photo_width,
      r.photo_height,
      r.total_count,
      r.rn
    FROM ranked r
    JOIN events e ON e.id = r.event_id
    WHERE r.rn <= ${thumbsPerRow}
      AND e.slug <> 'archive'
    ORDER BY e.date DESC, e.id DESC, r.rn ASC
  ` ) as GalleryRowSqlRow[];

  const byEvent = new Map<number, GalleryRow>();
  for (const r of rows) {
    let g = byEvent.get(r.event_id);
    if (!g) {
      g = {
        eventId: r.event_id,
        slug: r.slug,
        title: r.name,
        date: r.date,
        location: r.location,
        photoCount: r.total_count,
        thumbs: [],
      };
      byEvent.set(r.event_id, g);
    }
    g.thumbs.push({
      id: r.photo_id,
      url: r.blob_url,
      alt: r.original_filename ?? `Photo ${r.photo_id}`,
      width: r.photo_width,
      height: r.photo_height,
    });
  }
  return [...byEvent.values()];
}

/**
 * Marquee photo pool for the top of the public Photos page —
 * approved + marquee-tagged photos across all events, newest event first.
 * De-duplicated by original_filename within each event.
 */
export async function getMarqueePool(limit = 200): Promise<MarqueePhoto[]> {
  const rows = (await sql`
    WITH deduped AS (
      SELECT
        ep.*,
        e.date AS event_date,
        CASE
          WHEN ep.original_filename IS NULL OR ep.original_filename = '' THEN 1
          ELSE ROW_NUMBER() OVER (
            PARTITION BY ep.event_id, ep.original_filename
            ORDER BY ep.uploaded_at ASC, ep.id ASC
          )
        END AS dup_rn
      FROM event_photos ep
      JOIN events e ON e.id = ep.event_id
      WHERE ep.approval_status = 'approved'
        AND ep.display_role = 'marquee'
    )
    SELECT id, blob_url, original_filename, width, height
    FROM deduped
    WHERE dup_rn = 1
    ORDER BY event_date DESC, display_order ASC NULLS LAST, COALESCE(taken_at, uploaded_at) DESC, id DESC
    LIMIT ${limit}
  `) as Array<{
    id: number;
    blob_url: string;
    original_filename: string | null;
    width: number | null;
    height: number | null;
  }>;
  return rows.map((r) => ({
    id: r.id,
    url: r.blob_url,
    alt: r.original_filename ?? `Photo ${r.id}`,
    width: r.width,
    height: r.height,
  }));
}
