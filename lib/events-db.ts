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
  stripe_payment_link_id: string | null;
  stripe_price_id: string | null;
  ticket_price: string | null;
  total_tickets_sold: number;
  total_revenue: string;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AttendeeRecord = {
  id: number;
  event_id: number;
  alumni_id: number | null;
  attendee_type: "paid" | "comp" | "walk-in";
  stripe_session_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_customer_email: string | null;
  stripe_customer_name: string | null;
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
  checked_in: boolean;
  checked_in_at: string | null;
  qr_code_data: string | null;
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
};

export async function getEventBySlug(slug: string): Promise<EventRecord | null> {
  const rows = (await sql`SELECT * FROM events WHERE slug = ${slug} LIMIT 1`) as EventRecord[];
  return rows[0] ?? null;
}

export async function listEvents(): Promise<EventRecord[]> {
  return (await sql`SELECT * FROM events ORDER BY date DESC, id DESC`) as EventRecord[];
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
      al.photo_url AS alumni_photo_url
    FROM event_attendees a
    LEFT JOIN alumni al ON al.id = a.alumni_id
    WHERE a.event_id = ${eventId} AND a.deleted_at IS NULL
    ORDER BY a.paid_at DESC NULLS LAST, a.id DESC
  `) as AttendeeRecord[];
}
