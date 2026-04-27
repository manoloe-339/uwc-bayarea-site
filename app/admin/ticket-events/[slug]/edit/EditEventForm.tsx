"use client";

import Link from "next/link";
import { useState } from "react";

type Props = {
  slug: string;
  initial: {
    name: string;
    date: string;
    time: string | null;
    location: string | null;
    description: string | null;
    stripe_payment_link_id: string | null;
    ticket_price: string | null;
    event_type: "ticketed" | "casual";
  };
  action: (formData: FormData) => void;
};

export default function EditEventForm({ slug, initial, action }: Props) {
  const [eventType, setEventType] = useState<"ticketed" | "casual">(initial.event_type);

  return (
    <form action={action} className="bg-white border border-[color:var(--rule)] rounded-[10px] p-5 space-y-4">
      <fieldset>
        <legend className="block text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-2">
          Event kind
        </legend>
        <div className="grid sm:grid-cols-2 gap-2">
          <RadioCard
            checked={eventType === "ticketed"}
            onChange={() => setEventType("ticketed")}
            name="event_type"
            value="ticketed"
            title="Ticketed"
            hint="Stripe Payment Link, attendees sync from Stripe, QR check-in."
          />
          <RadioCard
            checked={eventType === "casual"}
            onChange={() => setEventType("casual")}
            name="event_type"
            value="casual"
            title="Casual"
            hint="No Stripe. Manually add attendees. Foodies, gallery-only events."
          />
        </div>
        {initial.event_type !== eventType && (
          <p className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-1.5">
            Changing the kind on save{eventType === "casual"
              ? " will hide Stripe sync and clear the Payment Link from this event."
              : " will surface Stripe sync — paste a Payment Link to enable it."}
          </p>
        )}
      </fieldset>

      <Field name="name" label="Event name" defaultValue={initial.name} required />
      <div className="grid sm:grid-cols-2 gap-4">
        <Field name="date" label="Date" type="date" defaultValue={initial.date} required />
        <Field name="time" label="Time" defaultValue={initial.time ?? ""} />
      </div>
      <Field name="location" label="Location" defaultValue={initial.location ?? ""} />
      <TextareaField name="description" label="Description" rows={3} defaultValue={initial.description ?? ""} />

      {eventType === "ticketed" && (
        <>
          <Field
            name="stripe_payment_link_id"
            label="Stripe Payment Link ID"
            defaultValue={initial.stripe_payment_link_id ?? ""}
          />
          <p className="text-xs text-[color:var(--muted)] -mt-2">
            Ticket price{" "}
            {initial.ticket_price
              ? (<>is <strong>${Number(initial.ticket_price).toFixed(2)}</strong>, pulled from Stripe on each sync.</>)
              : (<>will be pulled from the Payment Link on the next sync.</>)}
          </p>
        </>
      )}

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
  );
}

function RadioCard({
  checked,
  onChange,
  name,
  value,
  title,
  hint,
}: {
  checked: boolean;
  onChange: () => void;
  name: string;
  value: string;
  title: string;
  hint: string;
}) {
  return (
    <label
      className={`block cursor-pointer border rounded-[10px] p-3 transition-colors ${
        checked
          ? "border-navy bg-navy/5"
          : "border-[color:var(--rule)] hover:border-navy"
      }`}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        className="sr-only"
      />
      <div className="flex items-center gap-2 mb-1">
        <span
          className={`inline-block w-3 h-3 rounded-full border-2 ${
            checked ? "border-navy bg-navy" : "border-[color:var(--rule)]"
          }`}
        />
        <span className="font-bold text-[color:var(--navy-ink)] text-sm">{title}</span>
      </div>
      <p className="text-xs text-[color:var(--muted)]">{hint}</p>
    </label>
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
