import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { generateQRToken } from "@/lib/qr-code";
import {
  sendReminderToAttendee,
  type ReminderAttendee,
  type ReminderEvent,
} from "@/lib/attendee-reminder";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: idParam } = await params;
  const attendeeId = Number(idParam);
  if (!Number.isFinite(attendeeId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const rows = (await sql`
    SELECT
      a.id, a.event_id, a.attendee_type, a.deleted_at,
      a.alumni_id, a.stripe_customer_name, a.stripe_customer_email,
      a.amount_paid, a.qr_code_data,
      al.first_name AS alumni_first_name,
      al.last_name  AS alumni_last_name,
      al.email      AS alumni_email,
      e.id AS e_id, e.name AS e_name, e.date AS e_date,
      e.time AS e_time, e.location AS e_location, e.slug AS e_slug,
      e.reminder_subject AS e_subject, e.reminder_heading AS e_heading,
      e.reminder_body AS e_body,
      nt.status AS name_tag_status,
      nt.first_name AS name_tag_first_name,
      nt.last_name  AS name_tag_last_name,
      nt.uwc_college AS name_tag_college,
      nt.grad_year  AS name_tag_grad_year,
      nt.line_3     AS name_tag_line_3,
      nt.line_4     AS name_tag_line_4
    FROM event_attendees a
    JOIN events e ON e.id = a.event_id
    LEFT JOIN alumni al ON al.id = a.alumni_id
    LEFT JOIN event_name_tags nt ON nt.attendee_id = a.id
    WHERE a.id = ${attendeeId}
    LIMIT 1
  `) as {
    id: number;
    event_id: number;
    attendee_type: string;
    deleted_at: Date | null;
    alumni_id: number | null;
    stripe_customer_name: string | null;
    stripe_customer_email: string | null;
    amount_paid: string;
    qr_code_data: string | null;
    alumni_first_name: string | null;
    alumni_last_name: string | null;
    alumni_email: string | null;
    e_id: number;
    e_name: string;
    e_date: Date;
    e_time: string | null;
    e_location: string | null;
    e_slug: string;
    e_subject: string | null;
    e_heading: string | null;
    e_body: string | null;
    name_tag_status: "pending" | "fix" | "finalized" | null;
    name_tag_first_name: string | null;
    name_tag_last_name: string | null;
    name_tag_college: string | null;
    name_tag_grad_year: number | null;
    name_tag_line_3: string | null;
    name_tag_line_4: string | null;
  }[];
  const r = rows[0];
  if (!r) return NextResponse.json({ error: "Attendee not found" }, { status: 404 });
  if (r.deleted_at) return NextResponse.json({ error: "Attendee removed" }, { status: 400 });
  if (r.attendee_type !== "paid" && r.attendee_type !== "comp") {
    return NextResponse.json({ error: "Walk-ins can't be emailed" }, { status: 400 });
  }
  const recipient =
    (r.alumni_email && r.alumni_email.trim()) ||
    (r.stripe_customer_email && r.stripe_customer_email.trim()) ||
    null;
  if (!recipient || !recipient.includes("@")) {
    return NextResponse.json({ error: "No email on file" }, { status: 400 });
  }

  // Generate a token on-the-fly when missing so one-off sends don't require
  // the admin to hit the bulk generate button first.
  let token = r.qr_code_data;
  if (!token) {
    try {
      token = generateQRToken(r.id, r.event_id);
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Failed to generate QR" },
        { status: 500 }
      );
    }
    await sql`UPDATE event_attendees SET qr_code_data = ${token}, updated_at = NOW() WHERE id = ${r.id}`;
  }

  const attendee: ReminderAttendee = {
    id: r.id,
    alumni_id: r.alumni_id,
    stripe_customer_name: r.stripe_customer_name,
    stripe_customer_email: r.stripe_customer_email,
    amount_paid: r.amount_paid,
    qr_code_data: token,
    alumni_first_name: r.alumni_first_name,
    alumni_last_name: r.alumni_last_name,
    alumni_email: r.alumni_email,
    name_tag_status: r.name_tag_status,
    name_tag_first_name: r.name_tag_first_name,
    name_tag_last_name: r.name_tag_last_name,
    name_tag_college: r.name_tag_college,
    name_tag_grad_year: r.name_tag_grad_year,
    name_tag_line_3: r.name_tag_line_3,
    name_tag_line_4: r.name_tag_line_4,
  };
  const event: ReminderEvent = {
    id: r.e_id,
    name: r.e_name,
    date: r.e_date,
    time: r.e_time,
    location: r.e_location,
    reminder_subject: r.e_subject,
    reminder_heading: r.e_heading,
    reminder_body: r.e_body,
  };

  try {
    await sendReminderToAttendee(attendee, event);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Send failed" },
      { status: 502 }
    );
  }

  revalidatePath(`/admin/events/${r.e_slug}/attendees`);
  revalidatePath(`/admin/events/${r.e_slug}/communications`);
  return NextResponse.json({ ok: true, to: recipient });
}
