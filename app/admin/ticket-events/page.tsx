import Link from "next/link";
import { listEvents } from "@/lib/events-db";

export const dynamic = "force-dynamic";

function fmtDate(d: Date | string): string {
  return new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default async function TicketEventsIndexPage() {
  const events = await listEvents();

  return (
    <div className="max-w-[900px]">
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="font-sans text-4xl font-bold text-[color:var(--navy-ink)]">Ticket events</h1>
          <p className="text-[color:var(--muted)] text-sm">
            Paid events with Stripe-backed attendee lists.
          </p>
        </div>
        <Link
          href="/admin/ticket-events/new"
          className="text-sm font-semibold text-navy border border-navy px-4 py-2 rounded hover:bg-navy hover:text-white"
        >
          New event
        </Link>
      </div>

      {events.length === 0 ? (
        <div className="bg-white border border-dashed border-[color:var(--rule)] rounded-[10px] p-8 text-center text-sm text-[color:var(--muted)]">
          No ticket events yet.
        </div>
      ) : (
        <ul className="space-y-2">
          {events.map((e) => (
            <li
              key={e.id}
              className="bg-white border border-[color:var(--rule)] rounded-[10px] p-4 flex items-center justify-between"
            >
              <div className="min-w-0">
                <Link
                  href={`/admin/ticket-events/${e.slug}/attendees`}
                  className="font-semibold text-navy hover:underline"
                >
                  {e.name}
                </Link>
                <div className="text-xs text-[color:var(--muted)] mt-0.5">
                  {fmtDate(e.date)}
                  {e.time ? ` · ${e.time}` : ""}
                  {e.location ? ` · ${e.location}` : ""}
                </div>
              </div>
              <div className="text-xs text-[color:var(--muted)] text-right shrink-0 ml-4">
                <div>
                  <span className="font-semibold text-navy">{e.total_tickets_sold}</span> tickets
                </div>
                <div>${Number(e.total_revenue).toLocaleString()}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
