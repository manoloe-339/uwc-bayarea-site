"use client";

import Link from "next/link";
import { useState } from "react";
import { FOODIES_REGIONS } from "@/lib/foodies-shared";
import { FoodiesHostPicker, type HostAlumnus } from "@/components/admin/FoodiesHostPicker";
import { MarkdownTextarea } from "@/components/admin/MarkdownTextarea";
import {
  FeaturedAlumniManager,
  type FeaturedAlumnusEntry,
} from "@/components/admin/FeaturedAlumniManager";

type Props = {
  slug: string;
  initial: {
    name: string;
    date: string;
    time: string | null;
    location: string | null;
    location_map_url: string | null;
    description: string | null;
    stripe_payment_link_id: string | null;
    ticket_price: string | null;
    event_type: "ticketed" | "casual";
    is_foodies: boolean;
    gallery_description_md: string | null;
    foodies_region: string | null;
    foodies_cuisine: string | null;
    foodies_neighborhood: string | null;
    foodies_host_1: HostAlumnus | null;
    foodies_host_2: HostAlumnus | null;
    featured_alumni: FeaturedAlumnusEntry[];
  };
  action: (formData: FormData) => void;
};

export default function EditEventForm({ slug, initial, action }: Props) {
  const [eventType, setEventType] = useState<"ticketed" | "casual">(initial.event_type);
  const [isFoodies, setIsFoodies] = useState<boolean>(initial.is_foodies);

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

      <Field name="name" label="Event name" defaultValue={initial.name} required />
      <div className="grid sm:grid-cols-2 gap-4">
        <Field name="date" label="Date" type="date" defaultValue={initial.date} required />
        <Field name="time" label="Time" defaultValue={initial.time ?? ""} />
      </div>
      <Field name="location" label="Location" defaultValue={initial.location ?? ""} />
      <Field
        name="location_map_url"
        label="Map URL (optional — Google Maps link for the address)"
        defaultValue={initial.location_map_url ?? ""}
        type="url"
      />
      <TextareaField name="description" label="Description" rows={3} defaultValue={initial.description ?? ""} />

      <MarkdownTextarea
        name="gallery_description_md"
        label="Gallery page description (shown above the photos on /events/[slug]/photos)"
        rows={4}
        defaultValue={initial.gallery_description_md ?? ""}
        placeholder="e.g. Forty-seven alumni gathered for [Gil Yaron's fireside on eSwatini](https://example.com)…"
      />

      <fieldset className="border border-[color:var(--rule)] rounded p-4 space-y-3">
        <legend className="text-[11px] tracking-[.22em] uppercase font-bold text-navy px-1">
          Featured alumni on gallery page
        </legend>
        <p className="text-xs text-[color:var(--muted)]">
          Hand-picked alumni shown at the top of the public gallery —
          guest speakers, leads, hosts, etc. Each card shows photo,
          name, college/year, and either a custom role label or the
          alum&rsquo;s current job title.
        </p>
        <FeaturedAlumniManager name="featured_alumni" initial={initial.featured_alumni} />
      </fieldset>

      {eventType === "casual" && isFoodies && (
        <fieldset className="border border-[color:var(--rule)] rounded-[10px] p-4 space-y-3 bg-ivory/40">
          <legend className="text-[11px] tracking-[.22em] uppercase font-bold text-navy px-1">
            Foodies meal details
          </legend>
          <div className="grid sm:grid-cols-2 gap-4">
            <SelectField
              name="foodies_region"
              label="Region"
              defaultValue={initial.foodies_region ?? ""}
              options={["", ...FOODIES_REGIONS]}
            />
            <Field
              name="foodies_cuisine"
              label="Cuisine"
              defaultValue={initial.foodies_cuisine ?? ""}
            />
          </div>
          <Field
            name="foodies_neighborhood"
            label="Neighborhood"
            defaultValue={initial.foodies_neighborhood ?? ""}
          />
          <div className="grid sm:grid-cols-2 gap-4">
            <FoodiesHostPicker
              name="foodies_host_1_alumni_id"
              label="Host 1"
              initial={initial.foodies_host_1}
            />
            <FoodiesHostPicker
              name="foodies_host_2_alumni_id"
              label="Host 2"
              initial={initial.foodies_host_2}
            />
          </div>
        </fieldset>
      )}

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
          href={`/admin/events/${slug}/attendees`}
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

function SelectField({
  name, label, defaultValue, options,
}: {
  name: string; label: string; defaultValue?: string; options: readonly string[];
}) {
  return (
    <label className="block">
      <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-1">
        {label}
      </span>
      <select
        name={name}
        defaultValue={defaultValue ?? ""}
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
