import { sql } from "./db";

/** Joined view of a registered-alum WhatsApp request with the matched
 * alumni row's display fields. `alumni_id` is null when the homepage
 * modal name didn't resolve to a unique alumnus — those rows live as
 * unmatched entries until the admin disambiguates manually. */
export interface RegisteredWhatsappRequestRow {
  id: number;
  alumni_id: number | null;
  raw_name: string;
  sent_at: string | null;
  created_at: string;
  // Joined from alumni — null when alumni_id is null or the row was
  // deleted (FK is ON DELETE SET NULL).
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  uwc_college: string | null;
  grad_year: number | null;
  registered_at: string | null;
}

export async function listRegisteredWhatsappRequests(): Promise<
  RegisteredWhatsappRequestRow[]
> {
  return (await sql`
    SELECT r.id, r.alumni_id, r.raw_name, r.sent_at, r.created_at,
           a.first_name, a.last_name, a.email,
           a.uwc_college, a.grad_year,
           COALESCE(a.submitted_at, a.imported_at) AS registered_at
    FROM registered_whatsapp_requests r
    LEFT JOIN alumni a ON a.id = r.alumni_id
    ORDER BY r.created_at DESC, r.id DESC
  `) as RegisteredWhatsappRequestRow[];
}

/** Insert a new registered-alum request. `alumni_id` should be set
 * only when there's exactly one unambiguous name match (so listings
 * can show the alum's college/year/email without further lookup). */
export async function createRegisteredWhatsappRequest(data: {
  alumni_id: number | null;
  raw_name: string;
}): Promise<{ id: number }> {
  const rows = (await sql`
    INSERT INTO registered_whatsapp_requests (alumni_id, raw_name)
    VALUES (${data.alumni_id}, ${data.raw_name})
    RETURNING id
  `) as { id: number }[];
  return rows[0];
}

export async function markRegisteredWhatsappRequestSent(id: number): Promise<void> {
  await sql`
    UPDATE registered_whatsapp_requests
    SET sent_at = NOW()
    WHERE id = ${id}
  `;
}

export async function clearRegisteredWhatsappRequestSent(id: number): Promise<void> {
  await sql`
    UPDATE registered_whatsapp_requests
    SET sent_at = NULL
    WHERE id = ${id}
  `;
}

export async function countPendingRegisteredWhatsappRequests(): Promise<number> {
  const rows = (await sql`
    SELECT COUNT(*)::int AS n FROM registered_whatsapp_requests
    WHERE sent_at IS NULL
  `) as { n: number }[];
  return rows[0]?.n ?? 0;
}
