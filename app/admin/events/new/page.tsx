"use client";

import Link from "next/link";
import { useState } from "react";
import { createEventAction } from "./actions";
import { FOODIES_REGIONS } from "@/lib/foodies-shared";

export default function NewEventPage() {
  const [eventType, setEventType] = useState<"ticketed" | "casual">("ticketed");
  const [isFoodies, setIsFoodies] = useState<boolean>(false);
  return (
    <div className="max-w-[720px]">
      <div className="mb-4 text-sm">
        <Link href="/admin/events" className="text-[color:var(--muted)] hover:text-navy">
          ← Events
        </Link>
      </div>
      <h1 className="font-sans text-4xl font-bold text-[color:var(--navy-ink)] mb-1">New event</h1>
      <p className="text-[color:var(--muted)] text-sm mb-6">
        Ticketed events sync attendees from a Stripe Payment Link. Casual events
        are managed manually — add attendees as RSVPs come in. Both kinds support
        photo galleries and email reminders.
      </p>

      <form action={createEventAction} className="bg-white border border-[color:var(--rule)] rounded-[10px] p-5 space-y-4">
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

          {eventType === "casual" && (
            <label className="mt-3 flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                name="is_foodies"
                checked={isFoodies}
                onChange={(e) => setIsFoodies(e.target.checked)}
                className="mt-0.5"
              />
              <span className="text-sm">
                <span className="font-bold text-[color:var(--navy-ink)]">This is a Foodies meal</span>
                <span className="block text-xs text-[color:var(--muted)]">
                  Surfaces this event in the Foodies section on the homepage.
                </span>
              </span>
            </label>
          )}
        </fieldset>

        <Field name="name" label="Event name" placeholder="e.g. May 1 Tech Leadership Dinner" required />
        <Field name="slug" label="Slug (optional — derived from name)" placeholder="e.g. may-1-2026-dinner" />
        <div className="grid sm:grid-cols-2 gap-4">
          <Field name="date" label="Date" type="date" required />
          <Field name="time" label="Time" placeholder="e.g. 6:30 PM" />
        </div>
        <Field name="location" label="Location" placeholder="e.g. SF, TBD" />
        <TextareaField name="description" label="Description (optional)" rows={3} />

        {eventType === "casual" && isFoodies && (
          <fieldset className="border border-[color:var(--rule)] rounded-[10px] p-4 space-y-3 bg-ivory/40">
            <legend className="text-[11px] tracking-[.22em] uppercase font-bold text-navy px-1">
              Foodies meal details
            </legend>
            <div className="grid sm:grid-cols-2 gap-4">
              <SelectField
                name="foodies_region"
                label="Region"
                options={["", ...FOODIES_REGIONS]}
              />
              <Field name="foodies_cuisine" label="Cuisine" placeholder="e.g. Burmese" />
            </div>
            <Field name="foodies_neighborhood" label="Neighborhood" placeholder="e.g. Hayes Valley" />
            <div className="grid sm:grid-cols-2 gap-4">
              <Field name="foodies_host_1" label="Host 1" placeholder="e.g. Maria '12" />
              <Field name="foodies_host_2" label="Host 2" placeholder="e.g. Lior '10" />
            </div>
          </fieldset>
        )}

        {eventType === "ticketed" && (
          <>
            <Field name="stripe_payment_link_id" label="Stripe Payment Link ID" placeholder="plink_…" />
            <p className="text-xs text-[color:var(--muted)] -mt-2">
              Ticket price is pulled from the Payment Link on the first sync — no manual entry.
            </p>
          </>
        )}

        <div className="pt-2 flex justify-end gap-2">
          <Link href="/admin/events" className="px-4 py-2 text-sm text-[color:var(--muted)] hover:text-navy">
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

function SelectField({
  name, label, options,
}: {
  name: string; label: string; options: readonly string[];
}) {
  return (
    <label className="block">
      <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-1">
        {label}
      </span>
      <select
        name={name}
        defaultValue=""
        className="w-full border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt === "" ? "— choose —" : opt}
          </option>
        ))}
      </select>
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
