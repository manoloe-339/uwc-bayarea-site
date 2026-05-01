import { sql } from "./db";
import { extractUwcField } from "./attendee-uwc-fields";

export type NameTagStatus = "pending" | "fix" | "finalized";

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
  status: NameTagStatus;
  show_logo: boolean;
  created_at: string;
  updated_at: string;
  /** Joined for display (which ticket purchaser this tag came from). */
  attendee_alumni_first_name?: string | null;
  attendee_alumni_last_name?: string | null;
  attendee_stripe_customer_name?: string | null;
}

export async function setNameTagStatus(
  id: number,
  status: NameTagStatus
): Promise<NameTag | null> {
  const rows = (await sql`
    UPDATE event_name_tags
    SET status = ${status}, updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `) as NameTag[];
  return rows[0] ?? null;
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
    ORDER BY LOWER(t.first_name) ASC, LOWER(t.last_name) ASC, t.id ASC
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
interface AttendeeForSync {
  id: number;
  stripe_customer_name: string | null;
  stripe_custom_fields: unknown;
  alumni_first_name: string | null;
  alumni_last_name: string | null;
  uwc_college: string | null;
  grad_year: number | null;
}

interface DerivedFields {
  first: string;
  last: string;
  college: string | null;
  year: number | null;
  /** Raw UWC string from the Stripe checkout custom field — captured into
   * the admin-only notes when no alumni match exists. The user reads it
   * and decides for themselves what to put in college/year, instead of
   * the system parsing it (often wrongly). */
  stripeUwcNote: string | null;
}

/** Pull display fields from an attendee. College + year only come from
 * the alumni record (never auto-parsed from Stripe). When there's no
 * alumni match, the raw Stripe UWC field is surfaced via stripeUwcNote
 * so the admin can read it and decide. */
function deriveFromAttendee(a: AttendeeForSync): DerivedFields {
  const fromStripe = splitName(a.stripe_customer_name);
  const first = a.alumni_first_name ?? fromStripe.first;
  const last = a.alumni_last_name ?? fromStripe.last;
  const college = a.uwc_college;
  const year = a.grad_year;
  const stripeUwcNote =
    !college && year == null ? extractUwcField(a.stripe_custom_fields) : null;
  return { first, last, college, year, stripeUwcNote };
}

async function fetchAttendeesForSync(eventId: number): Promise<AttendeeForSync[]> {
  return (await sql`
    SELECT
      a.id,
      a.stripe_customer_name,
      a.stripe_custom_fields,
      al.first_name AS alumni_first_name,
      al.last_name  AS alumni_last_name,
      al.uwc_college,
      al.grad_year
    FROM event_attendees a
    LEFT JOIN alumni al ON al.id = a.alumni_id
    WHERE a.event_id = ${eventId} AND a.deleted_at IS NULL
    ORDER BY a.id ASC
  `) as AttendeeForSync[];
}

export async function syncNameTagsFromAttendees(eventId: number): Promise<SyncSummary> {
  const attendees = await fetchAttendeesForSync(eventId);
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
    const d = deriveFromAttendee(a);
    const notes = d.stripeUwcNote ? `Stripe UWC: ${d.stripeUwcNote}` : null;
    await sql`
      INSERT INTO event_name_tags (
        event_id, attendee_id, first_name, last_name, uwc_college, grad_year, notes
      ) VALUES (
        ${eventId}, ${a.id}, ${d.first}, ${d.last}, ${d.college}, ${d.year}, ${notes}
      )
    `;
    added++;
  }
  return { added, skipped };
}

/** Per-tag refresh: fill any currently-empty fields (first/last/college/
 * year) from the latest attendee source data. Never overwrites fields
 * that already have a value. Only works for tags linked to an attendee. */
export async function refreshNameTagFromSource(tagId: number): Promise<NameTag | null> {
  const tagRows = (await sql`SELECT * FROM event_name_tags WHERE id = ${tagId} LIMIT 1`) as NameTag[];
  const tag = tagRows[0];
  if (!tag) return null;
  if (tag.attendee_id == null) return tag;

  const attRows = (await sql`
    SELECT
      a.id,
      a.stripe_customer_name,
      a.stripe_custom_fields,
      al.first_name AS alumni_first_name,
      al.last_name  AS alumni_last_name,
      al.uwc_college,
      al.grad_year
    FROM event_attendees a
    LEFT JOIN alumni al ON al.id = a.alumni_id
    WHERE a.id = ${tag.attendee_id}
    LIMIT 1
  `) as AttendeeForSync[];
  if (attRows.length === 0) return tag;

  const d = deriveFromAttendee(attRows[0]);
  const stripeNote = d.stripeUwcNote ? `Stripe UWC: ${d.stripeUwcNote}` : null;
  const next = {
    first_name: tag.first_name && tag.first_name.trim() ? tag.first_name : d.first,
    last_name: tag.last_name && tag.last_name.trim() ? tag.last_name : d.last,
    uwc_college: tag.uwc_college && tag.uwc_college.trim() ? tag.uwc_college : d.college,
    grad_year: tag.grad_year != null ? tag.grad_year : d.year,
    notes: tag.notes && tag.notes.trim() ? tag.notes : stripeNote,
  };
  const updated = (await sql`
    UPDATE event_name_tags SET
      first_name  = ${next.first_name},
      last_name   = ${next.last_name},
      uwc_college = ${next.uwc_college},
      grad_year   = ${next.grad_year},
      notes       = ${next.notes},
      updated_at  = NOW()
    WHERE id = ${tagId}
    RETURNING *
  `) as NameTag[];
  return updated[0] ?? null;
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
  patch: Partial<Pick<NameTag, "first_name" | "last_name" | "uwc_college" | "grad_year" | "line_3" | "line_4" | "notes" | "show_logo">>
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
    show_logo: patch.show_logo !== undefined ? patch.show_logo : existing[0].show_logo,
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
      show_logo   = ${next.show_logo},
      updated_at  = NOW()
    WHERE id = ${id}
    RETURNING *
  `) as NameTag[];
  return rows[0] ?? null;
}

export async function deleteNameTag(id: number): Promise<void> {
  await sql`DELETE FROM event_name_tags WHERE id = ${id}`;
}
