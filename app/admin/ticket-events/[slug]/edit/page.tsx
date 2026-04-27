import Link from "next/link";
import { notFound } from "next/navigation";
import { getEventBySlug } from "@/lib/events-db";
import { updateEventAction } from "../../new/actions";
import EditEventForm from "./EditEventForm";

export const dynamic = "force-dynamic";

// Neon returns DATE columns as JS Date objects, not strings. Normalise to
// YYYY-MM-DD for <input type="date">.
function toDateInputValue(d: unknown): string {
  if (!d) return "";
  const date = d instanceof Date ? d : new Date(String(d));
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const event = await getEventBySlug(slug);
  if (!event) notFound();
  const update = updateEventAction.bind(null, event.id);

  return (
    <div className="max-w-[720px]">
      <div className="mb-4 text-sm">
        <Link href={`/admin/ticket-events/${slug}/attendees`} className="text-[color:var(--muted)] hover:text-navy">
          ← {event.name}
        </Link>
      </div>
      <h1 className="font-sans text-4xl font-bold text-[color:var(--navy-ink)] mb-6">Edit event</h1>

      <EditEventForm
        slug={slug}
        action={update}
        initial={{
          name: event.name,
          date: toDateInputValue(event.date),
          time: event.time,
          location: event.location,
          description: event.description,
          stripe_payment_link_id: event.stripe_payment_link_id,
          ticket_price: event.ticket_price,
          event_type: event.event_type,
        }}
      />
    </div>
  );
}
