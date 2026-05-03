import Link from "next/link";
import { notFound } from "next/navigation";
import { sql } from "@/lib/db";
import { getEventBySlug } from "@/lib/events-db";
import { getCheckinStats } from "@/lib/checkin-queries";
import { LiveDashboardRefresher } from "@/components/admin/LiveDashboardRefresher";
import { namesEffectivelyMatch } from "@/lib/name-similarity";
import { BulkCheckInList } from "./BulkCheckInList";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function fmtDateTime(s: string | null): string {
  if (!s) return "—";
  return new Date(s).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function LiveDashboardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const event = await getEventBySlug(slug);
  if (!event) notFound();
  const stats = await getCheckinStats(event.id);

  // Two sources of "expected to attend but not checked in":
  //   kind=attendee — regular event_attendees rows (paid, comp, or
  //     anyone with a linked name tag) where checked_in = FALSE.
  //   kind=name_tag — standalone event_name_tags rows with no
  //     attendee_id (VIPs / guest speakers added manually who never
  //     bought a ticket). Checking these in creates a comp attendee
  //     row and links the name tag to it.
  const noShows = (await sql`
    SELECT
      'attendee' AS kind,
      a.id AS row_id,
      a.amount_paid,
      a.stripe_customer_name AS purchaser_name,
      a.stripe_customer_email AS purchaser_email,
      NULLIF(TRIM(CONCAT_WS(' ', al.first_name, al.last_name)), '') AS alumni_name,
      al.email AS alumni_email,
      NULLIF(TRIM(CONCAT_WS(' ', nt.first_name, nt.last_name)), '') AS name_tag_name,
      LOWER(COALESCE(nt.last_name, al.last_name, a.stripe_customer_name, '')) AS sort_key
    FROM event_attendees a
    LEFT JOIN alumni al ON al.id = a.alumni_id
    LEFT JOIN event_name_tags nt ON nt.attendee_id = a.id
    WHERE a.event_id = ${event.id}
      AND a.deleted_at IS NULL
      AND a.checked_in = FALSE
      AND (a.refund_status IS NULL OR a.refund_status = 'partially_refunded')
      AND (
        a.attendee_type IN ('paid', 'comp')
        OR nt.id IS NOT NULL
      )

    UNION ALL

    SELECT
      'name_tag' AS kind,
      nt.id AS row_id,
      '0' AS amount_paid,
      NULL AS purchaser_name,
      NULL AS purchaser_email,
      NULL AS alumni_name,
      NULL AS alumni_email,
      NULLIF(TRIM(CONCAT_WS(' ', nt.first_name, nt.last_name)), '') AS name_tag_name,
      LOWER(COALESCE(nt.last_name, '')) AS sort_key
    FROM event_name_tags nt
    WHERE nt.event_id = ${event.id}
      AND nt.attendee_id IS NULL

    ORDER BY sort_key ASC
    LIMIT 200
  `) as {
    kind: "attendee" | "name_tag";
    row_id: number;
    amount_paid: string;
    purchaser_name: string | null;
    purchaser_email: string | null;
    alumni_name: string | null;
    alumni_email: string | null;
    name_tag_name: string | null;
    sort_key: string;
  }[];

  // Capacity = paid + comp rows (ticketed). Present = everyone checked in
  // (including walk-ins). Over capacity when present > capacity.
  const capacity = stats.totalRegistered;
  const present = stats.checkedIn;
  const overCapacity = present > capacity;
  const percent = capacity === 0 ? 0 : Math.round((present / capacity) * 100);

  return (
    <div className="max-w-[1000px]">
      <LiveDashboardRefresher />
      <div className="mb-4 text-sm">
        <Link
          href={`/admin/events/${slug}/attendees`}
          className="text-[color:var(--muted)] hover:text-navy"
        >
          ← {event.name}
        </Link>
      </div>
      <div className="flex items-end justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="font-sans text-4xl font-bold text-[color:var(--navy-ink)]">
            Live dashboard
          </h1>
          <p className="text-[color:var(--muted)] text-sm">
            Auto-refreshes every 10 seconds. Refresh the page for manual update.
          </p>
        </div>
        <Link
          href={`/admin/events/${slug}/attendees`}
          className="text-sm font-semibold text-navy border border-navy px-4 py-2 rounded hover:bg-navy hover:text-white"
        >
          ← Attendees
        </Link>
      </div>

      <section className="bg-white border border-[color:var(--rule)] rounded-[12px] p-5 mb-6">
        <div className="text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-2">
          Attendance
        </div>
        <div className="text-3xl font-sans font-bold text-navy">
          {present} / {capacity}
          <span className="text-base text-[color:var(--muted)] font-normal ml-2">
            ({percent}%)
          </span>
        </div>
        <div className="mt-3 h-3 bg-ivory-2 rounded-full overflow-hidden">
          <div
            className={`h-full ${
              overCapacity
                ? "bg-red-600"
                : percent >= 85
                  ? "bg-amber-500"
                  : "bg-green-600"
            } transition-all`}
            style={{ width: `${Math.min(100, percent)}%` }}
          />
        </div>
        <div className="mt-3 text-sm text-[color:var(--muted)] flex gap-4 flex-wrap">
          <span>
            Walk-ins: <strong className="text-[color:var(--navy-ink)]">{stats.walkIns}</strong>
          </span>
          <span>
            Last 5 min:{" "}
            <strong className="text-[color:var(--navy-ink)]">{stats.last5MinCount}</strong> checked in
          </span>
        </div>
        {overCapacity && (
          <div className="mt-3 bg-red-50 border-l-4 border-red-600 rounded-r p-3 text-sm text-red-900">
            <strong>⚠ Over capacity.</strong> {present - capacity} more present than
            tickets issued. Notify catering.
          </div>
        )}
      </section>

      <section className="bg-white border border-[color:var(--rule)] rounded-[12px] p-5 mb-6">
        <div className="text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-3">
          Checked in ({stats.recent.length})
        </div>
        {stats.recent.length === 0 ? (
          <p className="text-sm text-[color:var(--muted)]">No check-ins yet.</p>
        ) : (
          <ul className="space-y-1.5 text-sm max-h-[600px] overflow-y-auto pr-1">
            {stats.recent.map((r) => {
              // Two distinct cases drive the display:
              //   (a) Name tag matches the email-linked alum (or no name
              //       tag): the attendee IS the alum. Show their
              //       college/year. Suppress purchaser if same email
              //       (handles Stripe billing-name quirks).
              //   (b) Name tag differs from the alum: the attendee is a
              //       guest of the alum. Drop college/year (it belongs
               //       to the sponsor, not the guest) and ALWAYS show
               //       the purchaser so the sponsor is identified.
              const nameTagIsGuest =
                !!r.name_tag_name &&
                !!r.alumni_name &&
                !namesEffectivelyMatch(r.name_tag_name, r.alumni_name);
              const sameByEmail =
                !!r.purchaser_email &&
                !!r.alumni_email &&
                r.purchaser_email.trim().toLowerCase() ===
                  r.alumni_email.trim().toLowerCase();
              const showCollegeYear = !nameTagIsGuest;
              // Purchaser line is suppressed any time the purchaser
              // email matches the alum's — they ARE the alum, so the
              // Stripe-formatted name (sometimes a billing/team quirk)
              // adds no information. For guest rows, the alum's full
              // name shows up via the "alum: …" line elsewhere.
              const showPurchaser =
                !sameByEmail &&
                !!r.purchaser_name &&
                !namesEffectivelyMatch(r.purchaser_name, r.display_name);
              return (
                <li
                  key={r.id}
                  className="flex items-start justify-between gap-3"
                >
                  <span className="min-w-0">
                    <span className="block truncate">
                      ✓{" "}
                      <strong className="text-[color:var(--navy-ink)]">
                        {r.display_name}
                      </strong>
                      {showCollegeYear && r.uwc_college && (
                        <span className="text-[color:var(--muted)]">
                          {" "}· {r.uwc_college}
                          {r.grad_year ? ` '${String(r.grad_year).slice(-2)}` : ""}
                        </span>
                      )}
                      {r.attendee_type === "walk-in" && (
                        <span className="ml-1 text-[10px] text-indigo-700 uppercase tracking-wider font-bold">
                          walk-in
                        </span>
                      )}
                    </span>
                    {nameTagIsGuest && r.alumni_name && (
                      <span className="block text-[11px] text-[color:var(--muted)] truncate pl-4">
                        alum: {r.alumni_name}
                      </span>
                    )}
                    {showPurchaser && (
                      <span className="block text-[11px] text-[color:var(--muted)] truncate pl-4">
                        purchaser: {r.purchaser_name}
                      </span>
                    )}
                  </span>
                  <span className="text-xs text-[color:var(--muted)] tabular-nums shrink-0">
                    {fmtDateTime(r.checked_in_at)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="bg-white border border-[color:var(--rule)] rounded-[12px] p-5">
        <div className="flex items-baseline justify-between gap-3 flex-wrap mb-3">
          <div className="text-[11px] tracking-[.22em] uppercase font-bold text-navy">
            Not yet checked in ({noShows.length})
          </div>
          <div className="text-[11px] text-[color:var(--muted)]">
            Tick names + Check in to mark attendance after the event
          </div>
        </div>
        <BulkCheckInList eventId={event.id} slug={slug} attendees={noShows} />
      </section>
    </div>
  );
}
