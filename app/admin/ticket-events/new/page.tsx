import Link from "next/link";
import { createEventAction } from "./actions";

export const dynamic = "force-dynamic";

export default function NewEventPage() {
  return (
    <div className="max-w-[720px]">
      <div className="mb-4 text-sm">
        <Link href="/admin/ticket-events" className="text-[color:var(--muted)] hover:text-navy">
          ← Ticket events
        </Link>
      </div>
      <h1 className="font-sans text-4xl font-bold text-[color:var(--navy-ink)] mb-1">New ticket event</h1>
      <p className="text-[color:var(--muted)] text-sm mb-6">
        Create an event record. Paste the Stripe Payment Link ID so the sync button can pull purchases.
      </p>

      <form action={createEventAction} className="bg-white border border-[color:var(--rule)] rounded-[10px] p-5 space-y-4">
        <Field name="name" label="Event name" placeholder="e.g. May 1 Tech Leadership Dinner" required />
        <Field name="slug" label="Slug (optional — derived from name)" placeholder="e.g. may-1-2026-dinner" />
        <div className="grid sm:grid-cols-2 gap-4">
          <Field name="date" label="Date" type="date" required />
          <Field name="time" label="Time" placeholder="e.g. 6:30 PM" />
        </div>
        <Field name="location" label="Location" placeholder="e.g. SF, TBD" />
        <TextareaField name="description" label="Description (optional)" rows={3} />
        <Field name="stripe_payment_link_id" label="Stripe Payment Link ID" placeholder="plink_…" />
        <p className="text-xs text-[color:var(--muted)] -mt-2">
          Ticket price is pulled from the Payment Link on the first sync — no manual entry.
        </p>
        <div className="pt-2 flex justify-end gap-2">
          <Link href="/admin/ticket-events" className="px-4 py-2 text-sm text-[color:var(--muted)] hover:text-navy">
            Cancel
          </Link>
          <button type="submit" className="bg-navy text-white px-5 py-2.5 rounded text-sm font-semibold">
            Create event
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  name, label, placeholder, type = "text", required,
}: {
  name: string; label: string; placeholder?: string; type?: string; required?: boolean;
}) {
  return (
    <label className="block">
      <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-1">
        {label}
      </span>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        required={required}
        className="w-full border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white"
      />
    </label>
  );
}

function TextareaField({ name, label, rows }: { name: string; label: string; rows?: number }) {
  return (
    <label className="block">
      <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-1">
        {label}
      </span>
      <textarea
        name={name}
        rows={rows}
        className="w-full border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white"
      />
    </label>
  );
}
