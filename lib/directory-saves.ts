import { sql } from "./db";
import { MAX_NOTE_CHARS, type SaveReason, type SaveStatus } from "./directory-saves-shared";

// Re-export the shared constants/types so existing server-side
// imports of @/lib/directory-saves keep working without changes.
export {
  SAVE_STATUSES,
  SAVE_REASONS,
  STATUS_LABELS,
  REASON_LABELS,
  MAX_NOTE_CHARS,
  isSaveStatus,
  isSaveReason,
  type SaveStatus,
  type SaveReason,
} from "./directory-saves-shared";

export type DirectorySaveRow = {
  id: number;
  directory_user_id: number;
  alumni_id: number;
  reason: SaveReason | null;
  status: SaveStatus;
  note: string | null;
  created_at: Date;
  updated_at: Date;
  // Joined alumni fields for list rendering.
  alum_first_name: string | null;
  alum_last_name: string | null;
  alum_uwc_college: string | null;
  alum_grad_year: number | null;
  alum_current_title: string | null;
  alum_current_company: string | null;
  alum_current_company_linkedin: string | null;
  alum_current_city: string | null;
  alum_photo_url: string | null;
  alum_linkedin_url: string | null;
};

export async function listSavesForUser(
  directoryUserId: number,
): Promise<DirectorySaveRow[]> {
  const rows = (await sql`
    SELECT s.*,
           a.first_name      AS alum_first_name,
           a.last_name       AS alum_last_name,
           a.uwc_college     AS alum_uwc_college,
           a.grad_year       AS alum_grad_year,
           a.current_title   AS alum_current_title,
           a.current_company AS alum_current_company,
           a.current_company_linkedin AS alum_current_company_linkedin,
           a.current_city    AS alum_current_city,
           a.photo_url       AS alum_photo_url,
           a.linkedin_url    AS alum_linkedin_url
    FROM directory_saves s
    LEFT JOIN alumni a ON a.id = s.alumni_id
    WHERE s.directory_user_id = ${directoryUserId}
    ORDER BY s.updated_at DESC
  `) as DirectorySaveRow[];
  return rows;
}

export async function getSaveForAlumnus(
  directoryUserId: number,
  alumniId: number,
): Promise<{
  id: number;
  reason: SaveReason | null;
  status: SaveStatus;
  note: string | null;
} | null> {
  const rows = (await sql`
    SELECT id, reason, status, note
    FROM directory_saves
    WHERE directory_user_id = ${directoryUserId} AND alumni_id = ${alumniId}
    LIMIT 1
  `) as Array<{
    id: number;
    reason: SaveReason | null;
    status: SaveStatus;
    note: string | null;
  }>;
  return rows[0] ?? null;
}

export async function upsertSave(args: {
  directoryUserId: number;
  alumniId: number;
  status?: SaveStatus;
  reason?: SaveReason | null;
  note?: string | null;
}): Promise<DirectorySaveRow> {
  const status = args.status ?? "not_contacted";
  const reason = args.reason ?? null;
  const note =
    args.note != null ? args.note.slice(0, MAX_NOTE_CHARS) : null;
  // Note: ON CONFLICT only writes the fields that the caller actually
  // supplied. We can't easily express "ignore null inputs" in a single
  // INSERT, so the caller is responsible for passing the values they
  // want persisted. (The route handler does this from the request body.)
  const rows = (await sql`
    INSERT INTO directory_saves
      (directory_user_id, alumni_id, status, reason, note)
    VALUES
      (${args.directoryUserId}, ${args.alumniId}, ${status}, ${reason}, ${note})
    ON CONFLICT (directory_user_id, alumni_id) DO UPDATE SET
      status     = EXCLUDED.status,
      reason     = EXCLUDED.reason,
      note       = EXCLUDED.note,
      updated_at = NOW()
    RETURNING *
  `) as DirectorySaveRow[];
  return rows[0];
}

export async function deleteSave(
  directoryUserId: number,
  alumniId: number,
): Promise<void> {
  await sql`
    DELETE FROM directory_saves
    WHERE directory_user_id = ${directoryUserId} AND alumni_id = ${alumniId}
  `;
}
