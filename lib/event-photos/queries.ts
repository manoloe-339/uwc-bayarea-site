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

export async function getPhotoStats(eventId: number, eventSlug?: string): Promise<PhotoStats> {
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
  `) as Array<Omit<PhotoStats, "distributed">>;
  const main = rows[0];

  // For the archive event, count photos that originated here (by blob path)
  // but have since moved to other events via the separation routine.
  let distributed = 0;
  if (eventSlug === "archive") {
    const pathPrefix = `events/${eventId}/photos/%`;
    const r = (await sql`
      SELECT COUNT(*)::int AS n
      FROM event_photos
      WHERE event_id <> ${eventId}
        AND blob_pathname LIKE ${pathPrefix}
    `) as { n: number }[];
    distributed = r[0]?.n ?? 0;
  }

  return { ...main, distributed };
}

export interface DistributedPhoto extends EventPhoto {
  current_event_slug: string;
  current_event_name: string;
  current_event_date: Date;
}

/**
 * Photos that were originally uploaded to the archive event (their blob
 * pathname still has the archive event id) but have since been moved to
 * other events via the separation routine. Joined with the event they're
 * currently in for "Now in: [event]" display.
 */
export async function getDistributedArchivePhotos(archiveEventId: number): Promise<DistributedPhoto[]> {
  const pathPrefix = `events/${archiveEventId}/photos/%`;
  return (await sql`
    SELECT
      ep.*,
      e.slug AS current_event_slug,
      e.name AS current_event_name,
      e.date AS current_event_date
    FROM event_photos ep
    JOIN events e ON e.id = ep.event_id
    WHERE ep.event_id <> ${archiveEventId}
      AND ep.blob_pathname LIKE ${pathPrefix}
    ORDER BY COALESCE(ep.taken_at, ep.uploaded_at) DESC, ep.id DESC
  `) as DistributedPhoto[];
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
 *
 * De-duplicated by original_filename within the event so the layout view +
 * public gallery page don't render the same photo twice when an admin
 * approves a photo and one or more of its duplicates.
 */
export async function getApprovedPhotosOrdered(eventId: number): Promise<EventPhoto[]> {
  return (await sql`
    WITH ranked AS (
      SELECT
        *,
        CASE
          WHEN original_filename IS NULL OR original_filename = '' THEN 1
          ELSE ROW_NUMBER() OVER (
            PARTITION BY event_id, original_filename
            ORDER BY uploaded_at ASC, id ASC
          )
        END AS dup_rn
      FROM event_photos
      WHERE event_id = ${eventId} AND approval_status = 'approved'
    )
    SELECT * FROM ranked
    WHERE dup_rn = 1
    ORDER BY
      CASE WHEN display_role = 'marquee' THEN 0 ELSE 1 END,
      display_order ASC NULLS LAST,
      COALESCE(taken_at, uploaded_at) DESC,
      id DESC
  `) as EventPhoto[];
}

/**
 * One representative thumbnail per event id — preferring marquee-tagged
 * approved photos, falling back to any approved photo. Used by the admin
 * Events list to make rows easy to identify at a glance.
 */
export async function getEventThumbnails(
  eventIds: number[]
): Promise<Map<number, { id: number; blob_url: string }>> {
  if (eventIds.length === 0) return new Map();
  const rows = (await sql`
    WITH ranked AS (
      SELECT
        ep.event_id,
        ep.id,
        ep.blob_url,
        ROW_NUMBER() OVER (
          PARTITION BY ep.event_id
          ORDER BY
            CASE WHEN ep.display_role = 'marquee' THEN 0 ELSE 1 END,
            ep.display_order ASC NULLS LAST,
            COALESCE(ep.taken_at, ep.uploaded_at) DESC,
            ep.id DESC
        ) AS rn
      FROM event_photos ep
      WHERE ep.event_id = ANY(${eventIds})
        AND ep.approval_status = 'approved'
    )
    SELECT event_id, id, blob_url FROM ranked WHERE rn = 1
  `) as Array<{ event_id: number; id: number; blob_url: string }>;
  const map = new Map<number, { id: number; blob_url: string }>();
  for (const r of rows) map.set(r.event_id, { id: r.id, blob_url: r.blob_url });
  return map;
}

/** Manually set (or clear) the capture date for a photo. */
export async function setPhotoTakenAt(photoId: number, takenAt: Date | null): Promise<void> {
  await sql`
    UPDATE event_photos
    SET taken_at = ${takenAt}
    WHERE id = ${photoId}
  `;
}

/**
 * Move a photo into a specific event and stamp its capture date with
 * that event's date. Used by the lightbox "assign to gallery" dropdown
 * for archive photos whose date is unknown but which clearly belong to
 * a specific past gathering.
 *
 * Returns the target event's slug + name + date for the UI confirmation.
 */
export async function assignPhotoToEvent(
  photoId: number,
  eventId: number
): Promise<{ slug: string; name: string; date: Date } | null> {
  const evt = (await sql`
    SELECT id, slug, name, date FROM events WHERE id = ${eventId} LIMIT 1
  `) as Array<{ id: number; slug: string; name: string; date: Date }>;
  if (!evt[0]) return null;
  await sql`
    UPDATE event_photos
    SET event_id = ${evt[0].id},
        taken_at = ${evt[0].date},
        display_order = NULL
    WHERE id = ${photoId}
  `;
  return { slug: evt[0].slug, name: evt[0].name, date: evt[0].date };
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

export interface SeparateArchiveSummary {
  events: Array<{
    eventId: number;
    slug: string;
    name: string;
    date: string; // YYYY-MM-DD
    movedCount: number;
    isNew: boolean;
  }>;
  totalMoved: number;
  skippedNoDate: number;
}

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * Cluster archive photos by capture date (taken_at, 3-day gap), then
 * either create a new event per cluster or merge into the existing
 * archive-YYYY-MM-DD event, moving photos out of the archive bucket.
 *
 * Preserves display_role (marquee tag) on each moved photo; resets
 * display_order to NULL since ordering doesn't carry across events.
 *
 * Idempotent — re-running picks up newly-uploaded photos without
 * disturbing photos already moved.
 *
 * Photos with NULL taken_at are left in archive (no clustering signal).
 */
export async function separateArchiveIntoEvents(): Promise<SeparateArchiveSummary> {
  const arch = (await sql`
    SELECT id FROM events WHERE slug = 'archive' LIMIT 1
  `) as { id: number }[];
  if (!arch[0]) {
    return { events: [], totalMoved: 0, skippedNoDate: 0 };
  }
  const archiveId = arch[0].id;

  type ArchPhoto = {
    id: number;
    taken_at: Date;
  };
  const photos = (await sql`
    SELECT id, taken_at
    FROM event_photos
    WHERE event_id = ${archiveId} AND taken_at IS NOT NULL
    ORDER BY taken_at ASC, id ASC
  `) as ArchPhoto[];

  const skippedRows = (await sql`
    SELECT COUNT(*)::int AS n
    FROM event_photos
    WHERE event_id = ${archiveId} AND taken_at IS NULL
  `) as { n: number }[];
  const skippedNoDate = skippedRows[0]?.n ?? 0;

  if (photos.length === 0) {
    return { events: [], totalMoved: 0, skippedNoDate };
  }

  // Cluster by 3-day gap.
  const clusters: ArchPhoto[][] = [];
  let current: ArchPhoto[] = [];
  let lastTime = 0;
  for (const p of photos) {
    const t = new Date(p.taken_at).getTime();
    if (current.length === 0 || t - lastTime > THREE_DAYS_MS) {
      if (current.length > 0) clusters.push(current);
      current = [p];
    } else {
      current.push(p);
    }
    lastTime = t;
  }
  if (current.length > 0) clusters.push(current);

  const results: SeparateArchiveSummary["events"] = [];
  for (const cluster of clusters) {
    const earliest = new Date(cluster[0].taken_at);
    const date = earliest.toISOString().slice(0, 10);
    const slug = `archive-${date}`;
    const name = earliest.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    // Resolution order:
    // 1. Existing real event (slug NOT LIKE 'archive%') within the same
    //    3-day window — merge so archive imports land in user-named
    //    galleries rather than auto-named archive-YYYY-MM-DD ones.
    // 2. Existing archive-YYYY-MM-DD event with this exact slug.
    // 3. Create a new archive-YYYY-MM-DD event.
    // Date subtraction in Postgres returns days as an integer, so we
    // can compare day-count directly. 3-day window matches the cluster
    // gap threshold used above.
    const realMatch = (await sql`
      SELECT id, slug, name, date FROM events
      WHERE slug NOT LIKE 'archive%'
        AND ABS(date - ${date}::date) <= 3
      ORDER BY ABS(date - ${date}::date) ASC, id ASC
      LIMIT 1
    `) as Array<{ id: number; slug: string; name: string; date: Date }>;

    let eventId: number;
    let resolvedSlug: string;
    let resolvedName: string;
    let resolvedDate: string;
    let isNew = false;

    if (realMatch[0]) {
      eventId = realMatch[0].id;
      resolvedSlug = realMatch[0].slug;
      resolvedName = realMatch[0].name;
      resolvedDate = new Date(realMatch[0].date).toISOString().slice(0, 10);
    } else {
      const existing = (await sql`
        SELECT id FROM events WHERE slug = ${slug} LIMIT 1
      `) as { id: number }[];
      if (existing[0]) {
        eventId = existing[0].id;
      } else {
        const inserted = (await sql`
          INSERT INTO events (slug, name, date, event_type)
          VALUES (${slug}, ${name}, ${date}, 'casual')
          RETURNING id
        `) as { id: number }[];
        eventId = inserted[0].id;
        isNew = true;
      }
      resolvedSlug = slug;
      resolvedName = name;
      resolvedDate = date;
    }

    const photoIds = cluster.map((p) => p.id);
    await sql`
      UPDATE event_photos
      SET event_id = ${eventId},
          display_order = NULL
      WHERE id = ANY(${photoIds})
    `;

    results.push({
      eventId,
      slug: resolvedSlug,
      name: resolvedName,
      date: resolvedDate,
      movedCount: photoIds.length,
      isNew,
    });
  }

  const totalMoved = results.reduce((s, r) => s + r.movedCount, 0);
  return { events: results, totalMoved, skippedNoDate };
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
