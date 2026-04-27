import { sql } from "@/lib/db";
import type { EventPhoto, PhotoStats, ApprovalStatus } from "./types";

export async function getEventPhotos(
  eventId: number,
  status?: ApprovalStatus
): Promise<EventPhoto[]> {
  if (status) {
    return (await sql`
      SELECT * FROM event_photos
      WHERE event_id = ${eventId} AND approval_status = ${status}
      ORDER BY uploaded_at DESC, id DESC
    `) as EventPhoto[];
  }
  return (await sql`
    SELECT * FROM event_photos
    WHERE event_id = ${eventId}
    ORDER BY uploaded_at DESC, id DESC
  `) as EventPhoto[];
}

export async function getPhotosByIds(ids: number[]): Promise<EventPhoto[]> {
  if (ids.length === 0) return [];
  return (await sql`SELECT * FROM event_photos WHERE id = ANY(${ids})`) as EventPhoto[];
}

export async function getPhotoStats(eventId: number): Promise<PhotoStats> {
  const rows = (await sql`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE approval_status = 'approved')::int AS approved,
      COUNT(*) FILTER (WHERE approval_status = 'pending')::int AS pending,
      COUNT(*) FILTER (WHERE approval_status = 'rejected')::int AS rejected
    FROM event_photos
    WHERE event_id = ${eventId}
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
  uploaded_by_admin: boolean;
  approval_status?: ApprovalStatus;
}): Promise<EventPhoto> {
  const status: ApprovalStatus = data.approval_status ?? "pending";
  const approvedAt = status === "approved" ? new Date() : null;
  const rows = (await sql`
    INSERT INTO event_photos (
      event_id, blob_url, blob_pathname, original_filename, file_size_bytes,
      content_type, width, height, uploaded_by_admin, approval_status, approved_at
    ) VALUES (
      ${data.event_id}, ${data.blob_url}, ${data.blob_pathname},
      ${data.original_filename}, ${data.file_size_bytes},
      ${data.content_type}, ${data.width}, ${data.height},
      ${data.uploaded_by_admin}, ${status}, ${approvedAt}
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
  const token = randomBytes(32).toString("hex");
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
