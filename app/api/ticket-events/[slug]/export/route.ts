import { NextResponse, type NextRequest } from "next/server";
import Papa from "papaparse";
import { getEventBySlug, listAttendeesForEvent } from "@/lib/events-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const event = await getEventBySlug(slug);
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }
  const rows = await listAttendeesForEvent(event.id);
  const csv = Papa.unparse(
    rows.map((r) => {
      const name =
        [r.alumni_first_name, r.alumni_last_name].filter(Boolean).join(" ") ||
        r.stripe_customer_name ||
        "";
      const email = r.alumni_email ?? r.stripe_customer_email ?? "";
      const associatedName =
        [r.associated_first_name, r.associated_last_name].filter(Boolean).join(" ") || "";
      return {
        name,
        email,
        stripe_email: r.stripe_customer_email ?? "",
        college: r.alumni_uwc_college ?? "",
        grad_year: r.alumni_grad_year ?? "",
        attendee_type: r.attendee_type,
        amount_paid: r.amount_paid,
        paid_at: r.paid_at ?? "",
        refund_status: r.refund_status ?? "",
        match_status: r.match_status,
        match_confidence: r.match_confidence ?? "",
        associated_with: associatedName,
        relationship: r.relationship_type ?? "",
        potential_donor: r.is_potential_donor ? "yes" : "",
        signup_invite_sent_at: r.signup_invite_sent_at ?? "",
        notes: r.notes ?? "",
        starred: r.is_starred ? "yes" : "",
        followup: r.needs_followup ? "yes" : "",
        checked_in: r.checked_in ? "yes" : "",
        checked_in_at: r.checked_in_at ?? "",
      };
    })
  );
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${event.slug}-attendees-${stamp}.csv"`,
    },
  });
}
