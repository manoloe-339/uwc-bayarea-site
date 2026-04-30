import Link from "next/link";
import { listEvents } from "@/lib/events-db";
import { getEventThumbnails } from "@/lib/event-photos/queries";

export const dynamic = "force-dynamic";

function fmtDate(d: Date | string): string {
  return new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default async function TicketEventsIndexPage() {
  const events = await listEvents();
  const thumbs = await getEventThumbnails(events.map((e) => e.id));

  return (
    <div className="max-w-[900px]">
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="font-sans text-4xl font-bold text-[color:var(--navy-ink)]">Events</h1>
          <p className="text-[color:var(--muted)] text-sm">
            Ticketed events (Stripe-backed) and casual events (manually managed).
          </p>
        </div>
        <Link
          href="/admin/events/new"
          className="text-sm font-semibold text-navy border border-navy px-4 py-2 rounded hover:bg-navy hover:text-white"
        >
          New event
        </Link>
      </div>

      {events.length === 0 ? (
        <div className="bg-white border border-dashed border-[color:var(--rule)] rounded-[10px] p-8 text-center text-sm text-[color:var(--muted)]">
          No events yet.
        </div>
      ) : (
        <ul className="space-y-2">
          {events.map((e) => {
            const thumb = thumbs.get(e.id);
            return (
              <li
                key={e.id}
                className="bg-white border border-[color:var(--rule)] rounded-[10px] p-4 flex items-center gap-4"
              >
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/admin/events/${e.slug}/attendees`}
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
                <Link
                  href={`/admin/events/${e.slug}/photos`}
                  aria-label={`Photos for ${e.name}`}
                  title={thumb ? "Open photos" : "No photos yet"}
                  className="shrink-0 w-14 h-14 rounded overflow-hidden bg-[color:var(--ivory-2)] border border-[color:var(--rule)] hover:border-navy block"
                >
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={thumb.blob_url}
                      alt=""
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[10px] tracking-[.18em] uppercase text-[color:var(--muted)] font-semibold">
                      —
                    </div>
                  )}
                </Link>
                <div className="text-xs text-[color:var(--muted)] text-right shrink-0">
                  <div>
                    <span className="font-semibold text-navy">{e.total_tickets_sold}</span> tickets
                  </div>
                  <div>${Number(e.total_revenue).toLocaleString()}</div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
