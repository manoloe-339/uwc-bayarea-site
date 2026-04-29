import { sql } from "@/lib/db";
import type { EventPhoto, PhotoStats, ApprovalStatus, DisplayRole, PhotoFilter } from "./types";

/**
 * Within an event, photos sharing an `original_filename` are flagged as
 * duplicates of each other. The first uploaded (lowest uploaded_at, then id)
 * is the "primary" — it shows up in the All / Pending / Approved / Rejected
 * tabs as normal. The rest are siloed into the Duplicates tab so the user
 * doesn't end up approving the same photo multiple times.
 *
 * Photos with NULL or empty original_filename are never flagged.
 */

export interface PhotoWithDup extends EventPhoto {
  is_duplicate: boolean;
  primary_filename: string | null;
  primary_status: ApprovalStatus | null;
}

/**
 * Tab-aware photo list. "duplicates" returns just the non-primary rows;
 * other filters return only primary rows. Sort key is
 * COALESCE(taken_at, uploaded_at) DESC so EXIF date wins when present.
 */
export async function getEventPhotosForTab(
  eventId: number,
  filter: PhotoFilter
): Promise<PhotoWithDup[]> {
  const rows = (await sql`
    WITH ranked AS (
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
      WHERE ep.event_id = ${eventId}
    ),
    primaries AS (
      SELECT event_id, original_filename, approval_status AS primary_status
      FROM ranked
      WHERE dup_rn = 1
    )
    SELECT
      r.*,
      (r.dup_rn > 1) AS is_duplicate,
      p.original_filename AS primary_filename,
      p.primary_status
    FROM ranked r
    LEFT JOIN primaries p
      ON p.event_id = r.event_id
     AND p.original_filename = r.original_filename
    WHERE
      CASE
        WHEN ${filter} = 'duplicates' THEN r.dup_rn > 1
        WHEN ${filter} = 'all'        THEN r.dup_rn = 1
        WHEN ${filter} = 'pending'    THEN r.dup_rn = 1 AND r.approval_status = 'pending'
        WHEN ${filter} = 'approved'   THEN r.dup_rn = 1 AND r.approval_status = 'approved'
        WHEN ${filter} = 'rejected'   THEN r.dup_rn = 1 AND r.approval_status = 'rejected'
        ELSE FALSE
      END
    ORDER BY COALESCE(r.taken_at, r.uploaded_at) DESC, r.id DESC
  `) as PhotoWithDup[];
  return rows;
}

export async function getEventPhotos(
  eventId: number,
  status?: ApprovalStatus
): Promise<EventPhoto[]> {
  if (status) {
    return (await sql`
      SELECT * FROM event_photos
      WHERE event_id = ${eventId} AND approval_status = ${status}
      ORDER BY COALESCE(taken_at, uploaded_at) DESC, id DESC
    `) as EventPhoto[];
  }
  return (await sql`
    SELECT * FROM event_photos
    WHERE event_id = ${eventId}
    ORDER BY COALESCE(taken_at, uploaded_at) DESC, id DESC
  `) as EventPhoto[];
}

export async function getPhotosByIds(ids: number[]): Promise<EventPhoto[]> {
  if (ids.length === 0) return [];
  return (await sql`SELECT * FROM event_photos WHERE id = ANY(${ids})`) as EventPhoto[];
}

export async function getPhotoStats(eventId: number): Promise<PhotoStats> {
  const rows = (await sql`
    WITH ranked AS (
      SELECT
        approval_status,
        CASE
          WHEN original_filename IS NULL OR original_filename = '' THEN 1
          ELSE ROW_NUMBER() OVER (
            PARTITION BY event_id, original_filename
            ORDER BY uploaded_at ASC, id ASC
          )
        END AS dup_rn
      FROM event_photos
      WHERE event_id = ${eventId}
    )
    SELECT
      COUNT(*) FILTER (WHERE dup_rn = 1)::int                                  AS total,
      COUNT(*) FILTER (WHERE dup_rn = 1 AND approval_status = 'approved')::int AS approved,
      COUNT(*) FILTER (WHERE dup_rn = 1 AND approval_status = 'pending')::int  AS pending,
      COUNT(*) FILTER (WHERE dup_rn = 1 AND approval_status = 'rejected')::int AS rejected,
      COUNT(*) FILTER (WHERE dup_rn > 1)::int                                  AS duplicates
    FROM ranked
  `) as PhotoStats[];
  return rows[0];
}

export async function approvePhotos(photoIds: number[]): Promise<number> {
  if (photoIds.length === 0) return 0;
  const rows = (await sql`
    UPDATE event_photos
    SET approval_status = 'approved', approved_at = NOW()
    WHERE id = ANY(${photoIds})
    RETURNING id
  `) as { id: number }[];
  return rows.length;
}

export async function rejectPhotos(photoIds: number[]): Promise<number> {
  if (photoIds.length === 0) return 0;
  const rows = (await sql`
    UPDATE event_photos
    SET approval_status = 'rejected', approved_at = NOW()
    WHERE id = ANY(${photoIds})
    RETURNING id
  `) as { id: number }[];
  return rows.length;
}

export async function deletePhotosFromDb(photoIds: number[]): Promise<EventPhoto[]> {
  if (photoIds.length === 0) return [];
  return (await sql`
    DELETE FROM event_photos WHERE id = ANY(${photoIds})
    RETURNING *
  `) as EventPhoto[];
}

export async function recordPhoto(data: {
  event_id: number;
  blob_url: string;
  blob_pathname: string;
  original_filename: string | null;
  file_size_bytes: number | null;
  content_type: string | null;
  width: number | null;
  height: number | null;
  taken_at: Date | null;
  uploaded_by_admin: boolean;
  approval_status?: ApprovalStatus;
}): Promise<EventPhoto> {
  const status: ApprovalStatus = data.approval_status ?? "pending";
  const approvedAt = status === "approved" ? new Date() : null;
  const rows = (await sql`
    INSERT INTO event_photos (
      event_id, blob_url, blob_pathname, original_filename, file_size_bytes,
      content_type, width, height, taken_at, uploaded_by_admin,
      approval_status, approved_at
    ) VALUES (
      ${data.event_id}, ${data.blob_url}, ${data.blob_pathname},
      ${data.original_filename}, ${data.file_size_bytes},
      ${data.content_type}, ${data.width}, ${data.height},
      ${data.taken_at}, ${data.uploaded_by_admin},
      ${status}, ${approvedAt}
    )
    RETURNING *
  `) as EventPhoto[];
  return rows[0];
}

export type EventForUpload = {
  id: number;
  slug: string;
  name: string;
  date: Date;
  photo_upload_enabled: boolean;
};

export async function getEventByUploadToken(token: string): Promise<EventForUpload | null> {
  if (!token || token.length < 8) return null;
  const rows = (await sql`
    SELECT id, slug, name, date, photo_upload_enabled
    FROM events
    WHERE photo_upload_token = ${token}
    LIMIT 1
  `) as EventForUpload[];
  return rows[0] ?? null;
}

export async function generateUploadToken(eventId: number): Promise<string> {
  const { randomBytes } = await import("node:crypto");
  // 12 random bytes -> 16-char base64url; ~96 bits of entropy.
  const token = randomBytes(12).toString("base64url");
  await sql`
    UPDATE events
    SET photo_upload_token = ${token}, photo_upload_enabled = TRUE
    WHERE id = ${eventId}
  `;
  return token;
}

export async function setUploadEnabled(eventId: number, enabled: boolean): Promise<void> {
  await sql`
    UPDATE events
    SET photo_upload_enabled = ${enabled}
    WHERE id = ${eventId}
  `;
}

/**
 * Approved photos ordered for public gallery rendering:
 * marquee first (by display_order), then supporting (by display_order, then
 * EXIF-or-upload date). NULL display_order rows fall after numbered ones.
 */
export async function getApprovedPhotosOrdered(eventId: number): Promise<EventPhoto[]> {
  return (await sql`
    SELECT * FROM event_photos
    WHERE event_id = ${eventId} AND approval_status = 'approved'
    ORDER BY
      CASE WHEN display_role = 'marquee' THEN 0 ELSE 1 END,
      display_order ASC NULLS LAST,
      COALESCE(taken_at, uploaded_at) DESC,
      id DESC
  `) as EventPhoto[];
}

export async function setPhotoLayout(
  photoId: number,
  displayRole: DisplayRole | null,
  displayOrder: number | null
): Promise<void> {
  await sql`
    UPDATE event_photos
    SET display_role = ${displayRole}, display_order = ${displayOrder}
    WHERE id = ${photoId}
  `;
}

/**
 * One-click star/unstar for marquee.
 * Star (not currently marquee): mark as marquee + approve if pending.
 * Unstar (currently marquee): drop marquee role; leave approval status alone.
 */
export async function toggleStarMarquee(photoId: number): Promise<EventPhoto | null> {
  const rows = (await sql`SELECT * FROM event_photos WHERE id = ${photoId} LIMIT 1`) as EventPhoto[];
  const photo = rows[0];
  if (!photo) return null;

  if (photo.display_role === "marquee") {
    await sql`
      UPDATE event_photos
      SET display_role = NULL, display_order = NULL
      WHERE id = ${photoId}
    `;
  } else {
    const promoteToApproved = photo.approval_status === "pending";
    if (promoteToApproved) {
      await sql`
        UPDATE event_photos
        SET display_role = 'marquee',
            approval_status = 'approved',
            approved_at = NOW()
        WHERE id = ${photoId}
      `;
    } else {
      await sql`
        UPDATE event_photos
        SET display_role = 'marquee'
        WHERE id = ${photoId}
      `;
    }
  }

  const updated = (await sql`SELECT * FROM event_photos WHERE id = ${photoId} LIMIT 1`) as EventPhoto[];
  return updated[0] ?? null;
}

/**
 * Re-numbers display_order = 0..n for the given photo ids in array order,
 * and assigns them to the given role. Does so for the photos in this list only.
 */
export async function reorderPhotos(
  eventId: number,
  role: DisplayRole,
  photoIds: number[]
): Promise<void> {
  if (photoIds.length === 0) return;
  const orders = photoIds.map((_, idx) => idx);
  await sql`
    UPDATE event_photos AS ep
    SET display_role = ${role}, display_order = v.ord
    FROM (
      SELECT unnest(${photoIds}::int[]) AS id, unnest(${orders}::int[]) AS ord
    ) AS v
    WHERE ep.id = v.id AND ep.event_id = ${eventId}
  `;
}
