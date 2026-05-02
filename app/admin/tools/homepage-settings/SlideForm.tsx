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
  /** Used to seed the focal-point preview when image_url is blank
   * but a linked event has photos. Resolved server-side. */
  defaultImagePreviewUrl?: string | null;
}

type FocalMode = "top" | "center" | "bottom" | "custom";

function parseFocalPoint(raw: string): { mode: FocalMode; x: number; y: number } {
  const v = (raw ?? "").trim().toLowerCase();
  if (v === "top") return { mode: "top", x: 50, y: 0 };
  if (v === "bottom") return { mode: "bottom", x: 50, y: 100 };
  if (v === "center" || v === "") return { mode: "center", x: 50, y: 50 };
  // Custom "X% Y%"
  const m = v.match(/^(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%$/);
  if (m) {
    const x = Math.max(0, Math.min(100, Number(m[1])));
    const y = Math.max(0, Math.min(100, Number(m[2])));
    return { mode: "custom", x, y };
  }
  return { mode: "center", x: 50, y: 50 };
}

function focalPointValue(mode: FocalMode, x: number, y: number): string {
  if (mode === "custom") return `${x}% ${y}%`;
  return mode;
}

function fmtDate(d: Date | string): string {
  const dd = d instanceof Date ? d : new Date(String(d));
  if (Number.isNaN(dd.getTime())) return "";
  return dd.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export default function SlideForm({
  events, initial, action, submitLabel, defaultImagePreviewUrl,
}: Props) {
  const [eventId, setEventId] = useState<number | null>(initial.event_id);
  const [eyebrow, setEyebrow] = useState(initial.eyebrow);
  const [title, setTitle] = useState(initial.title);
  const [emphasis, setEmphasis] = useState(initial.emphasis);
  const [byline, setByline] = useState(initial.byline);
  const [ctaLabel, setCtaLabel] = useState(initial.cta_label);
  const [ctaHref, setCtaHref] = useState(initial.cta_href);
  const [imageUrl, setImageUrl] = useState(initial.image_url);

  const initialFocal = parseFocalPoint(initial.focal_point);
  const [focalMode, setFocalMode] = useState<FocalMode>(initialFocal.mode);
  const [focalX, setFocalX] = useState<number>(initialFocal.x);
  const [focalY, setFocalY] = useState<number>(initialFocal.y);

  const previewSrc = imageUrl || defaultImagePreviewUrl || null;
  const previewObjectPosition = focalPointValue(focalMode, focalX, focalY);

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

      <fieldset className="border border-[color:var(--rule)] rounded p-4 space-y-3">
        <legend className="text-[11px] tracking-[.22em] uppercase font-bold text-navy px-1">
          Photo focal point
        </legend>
        <input
          type="hidden"
          name="focal_point"
          value={previewObjectPosition}
        />
        <div className="grid sm:grid-cols-[280px_1fr] gap-4">
          <div className="space-y-2">
            <select
              value={focalMode}
              onChange={(e) => setFocalMode(e.target.value as FocalMode)}
              className="w-full border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white"
            >
              <option value="top">Top — keep the top, crop bottom</option>
              <option value="center">Center — crop top and bottom equally</option>
              <option value="bottom">Bottom — keep the bottom, crop top</option>
              <option value="custom">Custom — pick exact X/Y</option>
            </select>
            {focalMode === "custom" && (
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="block text-[10px] tracking-[.18em] uppercase font-bold text-[color:var(--muted)] mb-1">
                    X (% from left)
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    value={focalX}
                    onChange={(e) => setFocalX(clamp(Number(e.target.value), 0, 100))}
                    className="w-full border border-[color:var(--rule)] rounded px-2 py-1.5 text-sm bg-white"
                  />
                </label>
                <label className="block">
                  <span className="block text-[10px] tracking-[.18em] uppercase font-bold text-[color:var(--muted)] mb-1">
                    Y (% from top)
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    value={focalY}
                    onChange={(e) => setFocalY(clamp(Number(e.target.value), 0, 100))}
                    className="w-full border border-[color:var(--rule)] rounded px-2 py-1.5 text-sm bg-white"
                  />
                </label>
              </div>
            )}
            <p className="text-xs text-[color:var(--muted)]">
              {focalMode === "custom"
                ? "Click on the preview to set the focal point, or type X/Y values directly."
                : "Use Top when faces / action are near the top of the photo. Pick Custom for fine control."}
            </p>
          </div>
          <FocalPreview
            src={previewSrc}
            objectPosition={previewObjectPosition}
            onPick={(x, y) => {
              setFocalMode("custom");
              setFocalX(Math.round(x));
              setFocalY(Math.round(y));
            }}
          />
        </div>
      </fieldset>

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

function clamp(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}

function FocalPreview({
  src, objectPosition, onPick,
}: {
  src: string | null;
  objectPosition: string;
  onPick: (xPct: number, yPct: number) => void;
}) {
  if (!src) {
    return (
      <div className="flex items-center justify-center text-xs text-[color:var(--muted)] border border-dashed border-[color:var(--rule)] rounded p-4 min-h-[120px]">
        Pick an image URL or link an event to preview the crop.
      </div>
    );
  }
  return (
    <div className="space-y-1">
      {/* Desktop hero crop: 21:9 */}
      <button
        type="button"
        onClick={(e) => {
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          const x = ((e.clientX - rect.left) / rect.width) * 100;
          const y = ((e.clientY - rect.top) / rect.height) * 100;
          onPick(clamp(x, 0, 100), clamp(y, 0, 100));
        }}
        className="block relative w-full bg-[color:var(--ivory-2)] overflow-hidden rounded cursor-crosshair border border-[color:var(--rule)]"
        style={{ aspectRatio: "21 / 9" }}
        aria-label="Click to set focal point"
      >
        {/* Using <img> intentionally — Next/Image fill needs known sizes
            and this preview is admin-only (not perf-critical). */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt=""
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          style={{ objectPosition }}
        />
      </button>
      <div className="text-[10px] text-[color:var(--muted)] tracking-[.16em] uppercase">
        Desktop crop preview · click to pin focal point · current: {objectPosition}
      </div>
    </div>
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
