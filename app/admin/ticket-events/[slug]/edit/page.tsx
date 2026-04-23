import Link from "next/link";
import { notFound } from "next/navigation";
import { getEventBySlug } from "@/lib/events-db";
import { updateEventAction } from "../../new/actions";

export const dynamic = "force-dynamic";

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

      <form action={update} className="bg-white border border-[color:var(--rule)] rounded-[10px] p-5 space-y-4">
        <Field name="name" label="Event name" defaultValue={event.name} required />
        <div className="grid sm:grid-cols-2 gap-4">
          <Field name="date" label="Date" type="date" defaultValue={event.date.slice(0, 10)} required />
          <Field name="time" label="Time" defaultValue={event.time ?? ""} />
        </div>
        <Field name="location" label="Location" defaultValue={event.location ?? ""} />
        <TextareaField name="description" label="Description" rows={3} defaultValue={event.description ?? ""} />
        <div className="grid sm:grid-cols-2 gap-4">
          <Field
            name="stripe_payment_link_id"
            label="Stripe Payment Link ID"
            defaultValue={event.stripe_payment_link_id ?? ""}
          />
          <Field
            name="ticket_price"
            label="Ticket price (USD)"
            type="number"
            defaultValue={event.ticket_price ?? ""}
          />
        </div>
        <div className="pt-2 flex justify-end gap-2">
          <Link
            href={`/admin/ticket-events/${slug}/attendees`}
            className="px-4 py-2 text-sm text-[color:var(--muted)] hover:text-navy"
          >
            Cancel
          </Link>
          <button type="submit" className="bg-navy text-white px-5 py-2.5 rounded text-sm font-semibold">
            Save changes
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  name, label, defaultValue, type = "text", required,
}: {
  name: string; label: string; defaultValue?: string | number; type?: string; required?: boolean;
}) {
  return (
    <label className="block">
      <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-1">
        {label}
      </span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue ?? ""}
        required={required}
        className="w-full border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white"
      />
    </label>
  );
}

function TextareaField({
  name, label, rows, defaultValue,
}: {
  name: string; label: string; rows?: number; defaultValue?: string;
}) {
  return (
    <label className="block">
      <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-1">
        {label}
      </span>
      <textarea
        name={name}
        rows={rows}
        defaultValue={defaultValue ?? ""}
        className="w-full border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white"
      />
    </label>
  );
}
