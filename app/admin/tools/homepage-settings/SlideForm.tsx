"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { HeroFocalPoint } from "@/lib/hero-slides";

interface EventOption {
  id: number;
  slug: string;
  name: string;
  date: Date | string;
}

export interface SlideFormInitial {
  event_id: number | null;
  eyebrow: string;
  title: string;
  emphasis: string;
  byline: string;
  cta_label: string;
  cta_href: string;
  image_url: string;
  focal_point: HeroFocalPoint;
  sort_order: number;
  enabled: boolean;
}

interface Props {
  events: EventOption[];
  initial: SlideFormInitial;
  action: (formData: FormData) => void;
  submitLabel: string;
}

function fmtDate(d: Date | string): string {
  const dd = d instanceof Date ? d : new Date(String(d));
  if (Number.isNaN(dd.getTime())) return "";
  return dd.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export default function SlideForm({ events, initial, action, submitLabel }: Props) {
  const [eventId, setEventId] = useState<number | null>(initial.event_id);
  const [eyebrow, setEyebrow] = useState(initial.eyebrow);
  const [title, setTitle] = useState(initial.title);
  const [emphasis, setEmphasis] = useState(initial.emphasis);
  const [byline, setByline] = useState(initial.byline);
  const [ctaLabel, setCtaLabel] = useState(initial.cta_label);
  const [ctaHref, setCtaHref] = useState(initial.cta_href);
  const [imageUrl, setImageUrl] = useState(initial.image_url);

  const linkedEvent = useMemo(
    () => (eventId ? events.find((e) => e.id === eventId) ?? null : null),
    [eventId, events]
  );

  const autoFill = () => {
    if (!linkedEvent) return;
    if (!eyebrow) setEyebrow(fmtDate(linkedEvent.date));
    if (!title) setTitle("A look back at");
    if (!emphasis) setEmphasis(linkedEvent.name);
    if (!ctaLabel) setCtaLabel("See more photos →");
    if (!ctaHref) setCtaHref(`/events/${linkedEvent.slug}/photos`);
  };

  return (
    <form
      action={action}
      className="bg-white border border-[color:var(--rule)] rounded-[10px] p-5 space-y-4"
    >
      <div className="grid sm:grid-cols-[1fr_auto] gap-3 items-end">
        <label className="block">
          <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-1">
            Linked event (optional)
          </span>
          <select
            name="event_id"
            value={eventId ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              setEventId(v ? Number(v) : null);
            }}
            className="w-full border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white"
          >
            <option value="">— None (use manual image + CTA) —</option>
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {fmtDate(e.date)} · {e.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={autoFill}
          disabled={!linkedEvent}
          className="px-3 py-2 text-xs font-semibold border border-navy text-navy rounded hover:bg-navy/5 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Auto-fill from event
        </button>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Eyebrow (small label above)" value={eyebrow} onChange={setEyebrow} placeholder="e.g. May 1 · 2026 · A look back" />
        <Field label="Title (serif headline)" value={title} onChange={setTitle} required placeholder="e.g. The fascinating history of" />
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Emphasis (italicized accent word)" value={emphasis} onChange={setEmphasis} placeholder="e.g. eSwatini" />
        <Field label="Byline (one-line subtitle)" value={byline} onChange={setByline} placeholder="e.g. Fireside · 47 alumni gathered" />
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="CTA label" value={ctaLabel} onChange={setCtaLabel} placeholder="See more photos →" />
        <Field label="CTA link" value={ctaHref} onChange={setCtaHref} placeholder="/events/[slug]/photos" />
      </div>
      <Field
        label="Image URL override (leave blank to use linked event's first photo)"
        value={imageUrl}
        onChange={setImageUrl}
        placeholder="https://…"
      />

      <label className="block">
        <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-1">
          Photo focal point
        </span>
        <select
          name="focal_point"
          defaultValue={initial.focal_point}
          className="w-full sm:w-[280px] border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white"
        >
          <option value="top">Top — keep the top of the photo, crop bottom</option>
          <option value="center">Center — crop top and bottom equally</option>
          <option value="bottom">Bottom — keep the bottom, crop top</option>
        </select>
        <span className="block mt-1 text-xs text-[color:var(--muted)]">
          Use Top when faces / action are near the top of the photo.
        </span>
      </label>

      <div className="grid sm:grid-cols-[140px_1fr] gap-4 items-end">
        <label className="block">
          <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-1">
            Sort order
          </span>
          <input
            name="sort_order"
            type="number"
            defaultValue={initial.sort_order}
            className="w-full border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white"
          />
        </label>
        <label className="flex items-center gap-2 pb-2">
          <input
            type="checkbox"
            name="enabled"
            defaultChecked={initial.enabled}
            className="w-4 h-4"
          />
          <span className="text-sm font-semibold">Enabled</span>
        </label>
      </div>

      <div className="pt-2 flex justify-end gap-2">
        <Link
          href="/admin/tools/homepage-settings"
          className="px-4 py-2 text-sm text-[color:var(--muted)] hover:text-navy"
        >
          Cancel
        </Link>
        <button
          type="submit"
          className="bg-navy text-white px-5 py-2.5 rounded text-sm font-semibold"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

function Field({
  label, value, onChange, required, placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  placeholder?: string;
}) {
  // Field name derived from label slug — but we keep names canonical so
  // the action reads them by hand. Pass via name attribute below.
  return (
    <label className="block">
      <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-1">
        {label}
      </span>
      <input
        name={fieldNameFromLabel(label)}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        className="w-full border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white"
      />
    </label>
  );
}

function fieldNameFromLabel(label: string): string {
  // Map label → form field name. Avoids prop-drilling a name for every Field.
  if (label.startsWith("Eyebrow")) return "eyebrow";
  if (label.startsWith("Title")) return "title";
  if (label.startsWith("Emphasis")) return "emphasis";
  if (label.startsWith("Byline")) return "byline";
  if (label.startsWith("CTA label")) return "cta_label";
  if (label.startsWith("CTA link")) return "cta_href";
  if (label.startsWith("Image URL")) return "image_url";
  return "field";
}
