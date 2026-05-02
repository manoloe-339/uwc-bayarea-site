import Link from "next/link";
import { notFound } from "next/navigation";
import { getEventBySlug, getFoodiesHostsByIds } from "@/lib/events-db";
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

  const hostIds = [event.foodies_host_1_alumni_id, event.foodies_host_2_alumni_id].filter(
    (n): n is number => typeof n === "number"
  );
  const hostMap = await getFoodiesHostsByIds(hostIds);
  const host1 = event.foodies_host_1_alumni_id
    ? hostMap.get(event.foodies_host_1_alumni_id) ?? null
    : null;
  const host2 = event.foodies_host_2_alumni_id
    ? hostMap.get(event.foodies_host_2_alumni_id) ?? null
    : null;

  return (
    <div className="max-w-[720px]">
      <div className="mb-4 text-sm">
        <Link href={`/admin/events/${slug}/attendees`} className="text-[color:var(--muted)] hover:text-navy">
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
          location_map_url: event.location_map_url,
          description: event.description,
          stripe_payment_link_id: event.stripe_payment_link_id,
          ticket_price: event.ticket_price,
          event_type: event.event_type,
          is_foodies: event.is_foodies,
          foodies_region: event.foodies_region,
          foodies_cuisine: event.foodies_cuisine,
          foodies_neighborhood: event.foodies_neighborhood,
          foodies_host_1: host1
            ? {
                id: host1.id,
                first_name: host1.first_name,
                last_name: host1.last_name,
                email: host1.email,
                uwc_college: host1.uwc_college,
                grad_year: host1.grad_year,
              }
            : null,
          foodies_host_2: host2
            ? {
                id: host2.id,
                first_name: host2.first_name,
                last_name: host2.last_name,
                email: host2.email,
                uwc_college: host2.uwc_college,
                grad_year: host2.grad_year,
              }
            : null,
        }}
      />
    </div>
  );
}
