import { sql } from "./db";

export interface NameTag {
  id: number;
  event_id: number;
  attendee_id: number | null;
  first_name: string;
  last_name: string;
  uwc_college: string | null;
  grad_year: number | null;
  line_3: string | null;
  line_4: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  /** Joined for display (which ticket purchaser this tag came from). */
  attendee_alumni_first_name?: string | null;
  attendee_alumni_last_name?: string | null;
  attendee_stripe_customer_name?: string | null;
}

export async function listNameTagsForEvent(eventId: number): Promise<NameTag[]> {
  return (await sql`
    SELECT
      t.*,
      al.first_name AS attendee_alumni_first_name,
      al.last_name  AS attendee_alumni_last_name,
      a.stripe_customer_name AS attendee_stripe_customer_name
    FROM event_name_tags t
    LEFT JOIN event_attendees a ON a.id = t.attendee_id
    LEFT JOIN alumni al ON al.id = a.alumni_id
    WHERE t.event_id = ${eventId}
    ORDER BY t.last_name ASC, t.first_name ASC, t.id ASC
  `) as NameTag[];
}

/** Best-effort split of a single full name string into first/last. */
function splitName(full: string | null | undefined): { first: string; last: string } {
  if (!full) return { first: "", last: "" };
  const trimmed = full.trim().replace(/\s+/g, " ");
  if (!trimmed) return { first: "", last: "" };
  const parts = trimmed.split(" ");
  if (parts.length === 1) return { first: parts[0], last: "" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

export interface SyncSummary {
  added: number;
  skipped: number;
}

/**
 * For every attendee on this event, ensure a name tag row exists.
 * Pre-fills first/last/uwc_college/grad_year from the alumni record when
 * matched, else parses stripe_customer_name. Idempotent: never updates
 * existing rows or overwrites manual edits — only inserts for attendees
 * that don't yet have a tag (matched by attendee_id).
 */
export async function syncNameTagsFromAttendees(eventId: number): Promise<SyncSummary> {
  const attendees = (await sql`
    SELECT
      a.id,
      a.stripe_customer_name,
      al.first_name AS alumni_first_name,
      al.last_name  AS alumni_last_name,
      al.uwc_college,
      al.grad_year
    FROM event_attendees a
    LEFT JOIN alumni al ON al.id = a.alumni_id
    WHERE a.event_id = ${eventId} AND a.deleted_at IS NULL
    ORDER BY a.id ASC
  `) as Array<{
    id: number;
    stripe_customer_name: string | null;
    alumni_first_name: string | null;
    alumni_last_name: string | null;
    uwc_college: string | null;
    grad_year: number | null;
  }>;

  if (attendees.length === 0) return { added: 0, skipped: 0 };

  const existingIds = new Set(
    ((await sql`
      SELECT attendee_id FROM event_name_tags
      WHERE event_id = ${eventId} AND attendee_id IS NOT NULL
    `) as { attendee_id: number }[]).map((r) => r.attendee_id)
  );

  let added = 0;
  let skipped = 0;
  for (const a of attendees) {
    if (existingIds.has(a.id)) {
      skipped++;
      continue;
    }
    const fromStripe = splitName(a.stripe_customer_name);
    const first = a.alumni_first_name ?? fromStripe.first;
    const last = a.alumni_last_name ?? fromStripe.last;
    await sql`
      INSERT INTO event_name_tags (
        event_id, attendee_id, first_name, last_name, uwc_college, grad_year
      ) VALUES (
        ${eventId}, ${a.id}, ${first}, ${last}, ${a.uwc_college}, ${a.grad_year}
      )
    `;
    added++;
  }
  return { added, skipped };
}

export async function createStandaloneNameTag(
  eventId: number,
  data: Partial<Omit<NameTag, "id" | "event_id" | "attendee_id" | "created_at" | "updated_at">>
): Promise<NameTag> {
  const rows = (await sql`
    INSERT INTO event_name_tags (
      event_id, attendee_id, first_name, last_name, uwc_college, grad_year, line_3, line_4, notes
    ) VALUES (
      ${eventId}, NULL,
      ${data.first_name ?? ""},
      ${data.last_name ?? ""},
      ${data.uwc_college ?? null},
      ${data.grad_year ?? null},
      ${data.line_3 ?? null},
      ${data.line_4 ?? null},
      ${data.notes ?? null}
    )
    RETURNING *
  `) as NameTag[];
  return rows[0];
}

export async function updateNameTag(
  id: number,
  patch: Partial<Pick<NameTag, "first_name" | "last_name" | "uwc_college" | "grad_year" | "line_3" | "line_4" | "notes">>
): Promise<NameTag | null> {
  const existing = (await sql`SELECT * FROM event_name_tags WHERE id = ${id} LIMIT 1`) as NameTag[];
  if (!existing[0]) return null;
  const next = {
    first_name: patch.first_name ?? existing[0].first_name,
    last_name: patch.last_name ?? existing[0].last_name,
    uwc_college: patch.uwc_college !== undefined ? patch.uwc_college : existing[0].uwc_college,
    grad_year: patch.grad_year !== undefined ? patch.grad_year : existing[0].grad_year,
    line_3: patch.line_3 !== undefined ? patch.line_3 : existing[0].line_3,
    line_4: patch.line_4 !== undefined ? patch.line_4 : existing[0].line_4,
    notes: patch.notes !== undefined ? patch.notes : existing[0].notes,
  };
  const rows = (await sql`
    UPDATE event_name_tags SET
      first_name  = ${next.first_name},
      last_name   = ${next.last_name},
      uwc_college = ${next.uwc_college},
      grad_year   = ${next.grad_year},
      line_3      = ${next.line_3},
      line_4      = ${next.line_4},
      notes       = ${next.notes},
      updated_at  = NOW()
    WHERE id = ${id}
    RETURNING *
  `) as NameTag[];
  return rows[0] ?? null;
}

export async function deleteNameTag(id: number): Promise<void> {
  await sql`DELETE FROM event_name_tags WHERE id = ${id}`;
}
