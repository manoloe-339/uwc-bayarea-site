import { sql } from "./db";

export interface VisitingRequestRow {
  id: number;
  first_name: string;
  last_name: string;
  affiliation: string | null;
  email: string;
  phone: string;
  note: string | null;
  contacted_at: string | null;
  created_at: string;
}

export interface NewVisitingRequest {
  first_name: string;
  last_name: string;
  affiliation: string | null;
  email: string;
  phone: string;
  note: string | null;
}

export async function listVisitingRequests(): Promise<VisitingRequestRow[]> {
  return (await sql`
    SELECT id, first_name, last_name, affiliation, email, phone, note,
           contacted_at, created_at
    FROM visiting_requests
    ORDER BY created_at DESC, id DESC
  `) as VisitingRequestRow[];
}

export async function createVisitingRequest(
  data: NewVisitingRequest
): Promise<VisitingRequestRow> {
  const rows = (await sql`
    INSERT INTO visiting_requests (
      first_name, last_name, affiliation, email, phone, note
    ) VALUES (
      ${data.first_name}, ${data.last_name}, ${data.affiliation},
      ${data.email}, ${data.phone}, ${data.note}
    )
    RETURNING id, first_name, last_name, affiliation, email, phone, note,
              contacted_at, created_at
  `) as VisitingRequestRow[];
  return rows[0];
}

export async function setVisitingRequestContacted(
  id: number,
  contacted: boolean
): Promise<void> {
  await sql`
    UPDATE visiting_requests
    SET contacted_at = ${contacted ? new Date() : null}
    WHERE id = ${id}
  `;
}

export async function countPendingVisitingRequests(): Promise<number> {
  const rows = (await sql`
    SELECT COUNT(*)::int AS n
    FROM visiting_requests
    WHERE contacted_at IS NULL
  `) as { n: number }[];
  return rows[0]?.n ?? 0;
}

/** Strip everything but digits — used to build a wa.me URL from a
 * user-entered phone string like "+1 (415) 465-2848". */
export function whatsappDigits(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw.replace(/\D/g, "");
}

export function whatsappUrl(raw: string | null | undefined): string | null {
  const digits = whatsappDigits(raw);
  return digits ? `https://wa.me/${digits}` : null;
}
