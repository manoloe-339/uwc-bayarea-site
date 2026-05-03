import { sql } from "./db";

export type EventRecord = {
  id: number;
  slug: string;
  name: string;
  // Neon serialises DATE columns as JS Date objects, not ISO strings.
  date: Date;
  time: string | null;
  location: string | null;
  description: string | null;
  location_map_url: string | null;
  stripe_payment_link_id: string | null;
  stripe_price_id: string | null;
  ticket_price: string | null;
  total_tickets_sold: number;
  total_revenue: string;
  last_synced_at: string | null;
  checkin_token: string | null;
  checkin_pin: string | null;
  checkin_token_generated_at: string | null;
  reminder_subject: string | null;
  reminder_heading: string | null;
  reminder_body: string | null;
  reminder_scheduled_at: string | null;
  reminder_auto_sent_at: string | null;
  photo_upload_token: string | null;
  photo_upload_enabled: boolean;
  event_type: "ticketed" | "casual";
  is_foodies: boolean;
  gallery_description_md: string | null;
  foodies_region: string | null;
  foodies_cuisine: string | null;
  foodies_neighborhood: string | null;
  foodies_host_1_alumni_id: number | null;
  foodies_host_2_alumni_id: number | null;
  cuisine_country: string | null;
  cuisine_emoji: string | null;
  card_backdrop: string | null;
  card_backdrop_image_url: string | null;
  name_tag_layout: "standard" | "first-emphasis";
  created_at: string;
  updated_at: string;
};

export type AttendeeRecord = {
  id: number;
  event_id: number;
  alumni_id: number | null;
  attendee_type: "paid" | "comp" | "walk-in" | "casual";
  stripe_session_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_customer_email: string | null;
  stripe_customer_name: string | null;
  stripe_custom_fields: unknown;
  amount_paid: string;
  paid_at: string | null;
  refund_status: string | null;
  match_status: "pending" | "matched" | "needs_review" | "unmatched";
  match_confidence: "high" | "medium" | "low" | "manual" | null;
  match_reason: string | null;
  matched_at: string | null;
  notes: string | null;
  is_starred: boolean;
  needs_followup: boolean;
  // New in migration 025:
  associated_with_alumni_id: number | null;
  relationship_type: string | null;
  is_potential_donor: boolean;
  signup_invite_sent_at: string | null;
  checked_in: boolean;
  checked_in_at: string | null;
  qr_code_data: string | null;
  qr_code_sent_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined-in alumni fields (only populated when alumni_id is set).
  alumni_first_name: string | null;
  alumni_last_name: string | null;
  alumni_email: string | null;
  alumni_uwc_college: string | null;
  alumni_grad_year: number | null;
  alumni_photo_url: string | null;
  // Joined-in association row (the alum this attendee is "here with").
  associated_first_name: string | null;
  associated_last_name: string | null;
};

export async function getEventBySlug(slug: string): Promise<EventRecord | null> {
  const rows = (await sql`SELECT * FROM events WHERE slug = ${slug} LIMIT 1`) as EventRecord[];
  return rows[0] ?? null;
}

export async function listEvents(): Promise<EventRecord[]> {
  return (await sql`SELECT * FROM events ORDER BY date DESC, id DESC`) as EventRecord[];
}

export type FoodiesHostSummary = {
  id: number;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  uwc_college: string | null;
  grad_year: number | null;
  photo_url: string | null;
};

/** Fetch slim alumni records for Foodies host display (admin picker
 * initial state + homepage card rendering). Returns a Map keyed by id
 * so callers can look up either host slot directly. */
export async function getFoodiesHostsByIds(
  ids: number[]
): Promise<Map<number, FoodiesHostSummary>> {
  const map = new Map<number, FoodiesHostSummary>();
  const cleaned = Array.from(new Set(ids.filter((n) => Number.isFinite(n) && n > 0)));
  if (cleaned.length === 0) return map;
  const rows = (await sql`
    SELECT id, first_name, last_name, email, uwc_college, grad_year, photo_url
    FROM alumni
    WHERE id = ANY(${cleaned})
  `) as FoodiesHostSummary[];
  for (const r of rows) map.set(r.id, r);
  return map;
}

export type CommunicationStats = {
  totalEligible: number;
  qrGenerated: number;
  remindersSent: number;
  lastSentAt: string | null;
  matchedWithAlumni: number;
  guestsOnStripeEmail: number;
};

export async function getCommunicationStats(eventId: number): Promise<CommunicationStats> {
  const rows = (await sql`
    SELECT
      COUNT(*) FILTER (
        WHERE attendee_type IN ('paid', 'comp')
      )::int AS total_eligible,
      COUNT(*) FILTER (
        WHERE attendee_type IN ('paid', 'comp') AND qr_code_data IS NOT NULL
      )::int AS qr_generated,
      COUNT(*) FILTER (
        WHERE attendee_type IN ('paid', 'comp') AND qr_code_sent_at IS NOT NULL
      )::int AS reminders_sent,
      MAX(qr_code_sent_at) AS last_sent_at,
      COUNT(*) FILTER (
        WHERE attendee_type IN ('paid', 'comp') AND alumni_id IS NOT NULL
      )::int AS matched_with_alumni,
      COUNT(*) FILTER (
        WHERE attendee_type IN ('paid', 'comp')
          AND alumni_id IS NULL
          AND stripe_customer_email IS NOT NULL
          AND stripe_customer_email <> ''
      )::int AS guests_on_stripe_email
    FROM event_attendees
    WHERE event_id = ${eventId} AND deleted_at IS NULL
  `) as {
    total_eligible: number;
    qr_generated: number;
    reminders_sent: number;
    last_sent_at: Date | string | null;
    matched_with_alumni: number;
    guests_on_stripe_email: number;
  }[];
  const r = rows[0];
  return {
    totalEligible: r?.total_eligible ?? 0,
    qrGenerated: r?.qr_generated ?? 0,
    remindersSent: r?.reminders_sent ?? 0,
    lastSentAt: r?.last_sent_at ? new Date(r.last_sent_at).toISOString() : null,
    matchedWithAlumni: r?.matched_with_alumni ?? 0,
    guestsOnStripeEmail: r?.guests_on_stripe_email ?? 0,
  };
}

export async function listAttendeesForEvent(eventId: number): Promise<AttendeeRecord[]> {
  return (await sql`
    SELECT
      a.*,
      al.first_name AS alumni_first_name,
      al.last_name AS alumni_last_name,
      al.email AS alumni_email,
      al.uwc_college AS alumni_uwc_college,
      al.grad_year AS alumni_grad_year,
      al.photo_url AS alumni_photo_url,
      assoc.first_name AS associated_first_name,
      assoc.last_name AS associated_last_name
    FROM event_attendees a
    LEFT JOIN alumni al ON al.id = a.alumni_id
    LEFT JOIN alumni assoc ON assoc.id = a.associated_with_alumni_id
    WHERE a.event_id = ${eventId} AND a.deleted_at IS NULL
    ORDER BY a.paid_at DESC NULLS LAST, a.id DESC
  `) as AttendeeRecord[];
}
