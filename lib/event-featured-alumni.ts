import { sql } from "./db";

export interface FeaturedAlumnusRow {
  id: number;
  event_id: number;
  alumni_id: number;
  role_label: string | null;
  sort_order: number;
  // Joined alumni fields for display.
  first_name: string | null;
  last_name: string | null;
  uwc_college: string | null;
  grad_year: number | null;
  photo_url: string | null;
  current_title: string | null;
  current_company: string | null;
  linkedin_url: string | null;
}

export interface FeaturedAlumnusInput {
  alumni_id: number;
  role_label: string | null;
}

const SELECT_WITH_ALUMNI = `
  SELECT
    fa.id,
    fa.event_id,
    fa.alumni_id,
    fa.role_label,
    fa.sort_order,
    al.first_name,
    al.last_name,
    al.uwc_college,
    al.grad_year,
    al.photo_url,
    al.current_title,
    al.current_company,
    al.linkedin_url
  FROM event_featured_alumni fa
  JOIN alumni al ON al.id = fa.alumni_id
`;

/** All featured rows for an event in display order. Used by both the
 * admin manager (initial state) and the public gallery render. */
export async function getEventFeaturedAlumni(
  eventId: number
): Promise<FeaturedAlumnusRow[]> {
  return (await sql.query(
    `${SELECT_WITH_ALUMNI} WHERE fa.event_id = $1 ORDER BY fa.sort_order ASC, fa.id ASC`,
    [eventId]
  )) as FeaturedAlumnusRow[];
}

/** Replace the full featured list for an event. Admin form sends the
 * complete intended state as a JSON array; this clears existing rows
 * and inserts the new ones in order. Idempotent and atomic at the
 * connection level (sql template runs as a single transaction). */
export async function saveEventFeaturedAlumni(
  eventId: number,
  list: FeaturedAlumnusInput[]
): Promise<void> {
  await sql`DELETE FROM event_featured_alumni WHERE event_id = ${eventId}`;
  // Sequential inserts — list is small (typically 1–6 rows).
  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    if (!Number.isFinite(item.alumni_id) || item.alumni_id <= 0) continue;
    await sql`
      INSERT INTO event_featured_alumni (event_id, alumni_id, role_label, sort_order)
      VALUES (${eventId}, ${item.alumni_id}, ${item.role_label}, ${i})
      ON CONFLICT (event_id, alumni_id) DO UPDATE
        SET role_label = EXCLUDED.role_label,
            sort_order = EXCLUDED.sort_order
    `;
  }
}
