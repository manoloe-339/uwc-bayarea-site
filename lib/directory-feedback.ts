import { sql } from "./db";

export type DirectoryFeedbackRow = {
  id: number;
  session_id: string;
  topic: "general" | "profile" | "bug";
  alumni_id: number | null;
  message: string;
  contact_name: string | null;
  page_url: string | null;
  status: "unread" | "read" | "dismissed";
  created_at: Date;
  reviewed_at: Date | null;
  // Joined
  alum_first_name: string | null;
  alum_last_name: string | null;
};

export async function listDirectoryFeedback(
  onlyUnread = true,
): Promise<DirectoryFeedbackRow[]> {
  const where = onlyUnread ? "WHERE f.status = 'unread'" : "";
  const rows = (await sql.query(
    `SELECT f.*,
            a.first_name AS alum_first_name,
            a.last_name  AS alum_last_name
       FROM directory_feedback f
       LEFT JOIN alumni a ON a.id = f.alumni_id
       ${where}
       ORDER BY f.created_at DESC
       LIMIT 500`,
  )) as DirectoryFeedbackRow[];
  return rows;
}

export async function countUnreadDirectoryFeedback(): Promise<number> {
  const rows = (await sql`
    SELECT COUNT(*)::int AS n
    FROM directory_feedback
    WHERE status = 'unread'
  `) as { n: number }[];
  return rows[0]?.n ?? 0;
}

export async function setDirectoryFeedbackStatus(
  id: number,
  status: "read" | "dismissed",
): Promise<void> {
  await sql`
    UPDATE directory_feedback
    SET status = ${status}, reviewed_at = NOW()
    WHERE id = ${id}
  `;
}
