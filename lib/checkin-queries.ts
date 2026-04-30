import { sql } from "./db";

export type CheckinHit = {
  id: number;
  attendee_type: "paid" | "comp" | "walk-in";
  amount_paid: string;
  checked_in: boolean;
  checked_in_at: string | null;
  refund_status: string | null;
  /** Display name — finalized name tag wins, then alumni, then split Stripe name. */
  display_first: string | null;
  display_last: string | null;
  display_email: string | null;
  uwc_college: string | null;
  grad_year: number | null;
  origin: string | null;
  photo_url: string | null;
  alumni_id: number | null;
  paid_at: string | null;
  /** Original ticket-purchaser name when the display name comes from a
   * finalized name tag override and differs. Null otherwise. Volunteer UI
   * can show this as a small subtitle so the same attendee remains
   * identifiable across events / past lists. */
  original_ticket_first: string | null;
  original_ticket_last: string | null;
  /** Status of the linked name tag, if any — lets the check-in UI flag
   * tags that still need review. */
  name_tag_status: "pending" | "fix" | "finalized" | null;
};

/** Shared SELECT clause + LEFT JOINs that produce a CheckinHit row. */
const CHECKIN_HIT_SELECT = `
  SELECT
    a.id, a.attendee_type, a.amount_paid, a.checked_in, a.checked_in_at,
    a.refund_status, a.alumni_id, a.paid_at,
    -- Display name: prefer finalized name tag override, else alumni, else
    -- the split Stripe customer name. We split Stripe at the LAST space
    -- to handle multi-word first names (e.g., "Mary Anne Smith").
    COALESCE(
      CASE WHEN nt.status = 'finalized' AND nt.first_name <> '' THEN nt.first_name END,
      al.first_name,
      split_part(a.stripe_customer_name, ' ', 1)
    ) AS display_first,
    COALESCE(
      CASE WHEN nt.status = 'finalized' AND nt.last_name <> '' THEN nt.last_name END,
      al.last_name,
      CASE
        WHEN position(' ' IN COALESCE(a.stripe_customer_name, '')) > 0
        THEN split_part(a.stripe_customer_name, ' ',
                        array_length(string_to_array(a.stripe_customer_name, ' '), 1))
        ELSE NULL
      END
    ) AS display_last,
    COALESCE(al.email, a.stripe_customer_email) AS display_email,
    -- College + year: prefer finalized tag, else alumni record.
    COALESCE(
      CASE WHEN nt.status = 'finalized' AND nt.uwc_college IS NOT NULL THEN nt.uwc_college END,
      al.uwc_college
    ) AS uwc_college,
    COALESCE(
      CASE WHEN nt.status = 'finalized' AND nt.grad_year IS NOT NULL THEN nt.grad_year END,
      al.grad_year
    ) AS grad_year,
    al.origin AS origin,
    al.photo_url AS photo_url,
    -- Original ticket-purchaser name (only populated when a finalized
    -- override actually changes the displayed name).
    CASE
      WHEN nt.status = 'finalized'
        AND nt.first_name <> ''
        AND COALESCE(nt.first_name, '') <> COALESCE(al.first_name, split_part(a.stripe_customer_name, ' ', 1), '')
      THEN COALESCE(al.first_name, split_part(a.stripe_customer_name, ' ', 1))
      ELSE NULL
    END AS original_ticket_first,
    CASE
      WHEN nt.status = 'finalized'
        AND nt.last_name <> ''
        AND COALESCE(nt.last_name, '') <> COALESCE(al.last_name, '')
      THEN COALESCE(al.last_name, NULL)
      ELSE NULL
    END AS original_ticket_last,
    nt.status AS name_tag_status
  FROM event_attendees a
  LEFT JOIN alumni al ON al.id = a.alumni_id
  LEFT JOIN event_name_tags nt ON nt.attendee_id = a.id
`;

/**
 * Search attendees at an event by (normalised, diacritic-insensitive) last
 * name. Matches three sources:
 *   1. Matched alumni's last_name / first_name
 *   2. Unmatched attendees' stripe_customer_name last word
 *   3. Walk-ins (stored in stripe_customer_name too)
 * Deceased alumni are excluded; soft-deleted attendee rows are excluded.
 */
export async function searchAttendeesByName(
  eventId: number,
  query: string,
  limit = 20
): Promise<CheckinHit[]> {
  const q = query.trim();
  if (q.length < 1) return [];
  const like = `%${q}%`;

  const rows = (await sql.query(
    `${CHECKIN_HIT_SELECT}
    WHERE a.event_id = $1
      AND a.deleted_at IS NULL
      AND (
        unaccent(lower(COALESCE(al.last_name, ''))) LIKE unaccent(lower($2))
        OR unaccent(lower(COALESCE(al.first_name, ''))) LIKE unaccent(lower($2))
        OR unaccent(lower(COALESCE(al.first_name, '') || ' ' || COALESCE(al.last_name, '')))
           LIKE unaccent(lower($2))
        OR unaccent(lower(COALESCE(a.stripe_customer_name, ''))) LIKE unaccent(lower($2))
        OR unaccent(lower(COALESCE(nt.first_name, '') || ' ' || COALESCE(nt.last_name, '')))
           LIKE unaccent(lower($2))
      )
    ORDER BY
      a.checked_in ASC,
      COALESCE(nt.last_name, al.last_name, a.stripe_customer_name, '') ASC
    LIMIT $3`,
    [eventId, like, limit]
  )) as CheckinHit[];
  return rows;
}

export async function getAttendeeForCheckin(
  attendeeId: number,
  eventId: number
): Promise<CheckinHit | null> {
  const rows = (await sql.query(
    `${CHECKIN_HIT_SELECT}
    WHERE a.id = $1 AND a.event_id = $2 AND a.deleted_at IS NULL
    LIMIT 1`,
    [attendeeId, eventId]
  )) as CheckinHit[];
  return rows[0] ?? null;
}

export type CheckinStats = {
  totalRegistered: number;
  checkedIn: number;
  walkIns: number;
  totalPresent: number;
  recent: Array<{
    id: number;
    display_name: string;
    checked_in_at: string;
    attendee_type: "paid" | "comp" | "walk-in";
    uwc_college: string | null;
    grad_year: number | null;
    photo_url: string | null;
  }>;
  last5MinCount: number;
};

export async function getCheckinStats(eventId: number): Promise<CheckinStats> {
  const [counts] = (await sql`
    SELECT
      COUNT(*) FILTER (
        WHERE attendee_type IN ('paid', 'comp')
      )::int AS total_registered,
      COUNT(*) FILTER (WHERE checked_in = TRUE)::int AS checked_in,
      COUNT(*) FILTER (WHERE attendee_type = 'walk-in')::int AS walk_ins,
      COUNT(*) FILTER (
        WHERE checked_in = TRUE AND checked_in_at > NOW() - INTERVAL '5 minutes'
      )::int AS last_5_min
    FROM event_attendees
    WHERE event_id = ${eventId} AND deleted_at IS NULL
  `) as {
    total_registered: number;
    checked_in: number;
    walk_ins: number;
    last_5_min: number;
  }[];

  const recent = (await sql`
    SELECT
      a.id, a.attendee_type, a.checked_in_at,
      COALESCE(
        NULLIF(TRIM(CONCAT_WS(' ', al.first_name, al.last_name)), ''),
        a.stripe_customer_name
      ) AS display_name,
      al.uwc_college, al.grad_year, al.photo_url
    FROM event_attendees a
    LEFT JOIN alumni al ON al.id = a.alumni_id
    WHERE a.event_id = ${eventId}
      AND a.deleted_at IS NULL
      AND a.checked_in = TRUE
    ORDER BY a.checked_in_at DESC
    LIMIT 10
  `) as CheckinStats["recent"];

  return {
    totalRegistered: counts.total_registered,
    checkedIn: counts.checked_in,
    walkIns: counts.walk_ins,
    totalPresent: counts.checked_in,
    recent,
    last5MinCount: counts.last_5_min,
  };
}
