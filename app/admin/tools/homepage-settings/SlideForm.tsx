"use client";

import Link from "next/link";
import Image from "next/image";
import { useMemo, useState } from "react";
import type { HeroFocalPoint, ExtraImageSetting } from "@/lib/hero-slides";

interface EventOption {
  id: number;
  slug: string;
  name: string;
  date: Date | string;
}

export interface ExtraGalleryPhoto {
  id: number;
  url: string;
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
  zoom: number;
  mobile_focal_point: HeroFocalPoint;
  mobile_zoom: number;
  extra_image_settings: ExtraImageSetting[];
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
  /** Photos available for positions 1..N when admin chooses to show
   * multiple images from the linked event's gallery. Excludes the
   * primary photo. Resolved server-side. */
  extraGalleryPhotos?: ExtraGalleryPhoto[];
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
  extraGalleryPhotos = [],
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
  const [zoom, setZoom] = useState<number>(initial.zoom ?? 1);

  const initialMobile = parseFocalPoint(initial.mobile_focal_point);
  const [mobileFocalMode, setMobileFocalMode] = useState<FocalMode>(initialMobile.mode);
  const [mobileFocalX, setMobileFocalX] = useState<number>(initialMobile.x);
  const [mobileFocalY, setMobileFocalY] = useState<number>(initialMobile.y);
  const [mobileZoom, setMobileZoom] = useState<number>(initial.mobile_zoom ?? 1);
  const mobileObjectPosition = focalPointValue(mobileFocalMode, mobileFocalX, mobileFocalY);

  const [extras, setExtras] = useState<ExtraImageSetting[]>(initial.extra_image_settings ?? []);
  const maxExtras = extraGalleryPhotos.length;
  const updateExtra = (i: number, patch: Partial<ExtraImageSetting>) => {
    setExtras((prev) => prev.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  };
  const setExtraCount = (n: number) => {
    const clamped = Math.max(0, Math.min(maxExtras, n));
    setExtras((prev) => {
      const next = [...prev];
      while (next.length < clamped)
        next.push({
          focal_point: "center",
          zoom: 1,
          mobile_focal_point: "center",
          mobile_zoom: 1,
        });
      next.length = clamped;
      return next;
    });
  };

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
            zoom={zoom}
            onPick={(x, y) => {
              setFocalMode("custom");
              setFocalX(Math.round(x));
              setFocalY(Math.round(y));
            }}
          />
        </div>

        <div className="border-t border-[color:var(--rule)] pt-3">
          <input type="hidden" name="zoom" value={zoom.toFixed(2)} />
          <div className="flex items-baseline justify-between mb-1.5">
            <span className="text-[11px] tracking-[.22em] uppercase font-bold text-navy">
              Zoom
            </span>
            <span className="text-xs text-[color:var(--muted)] font-mono">
              {zoom.toFixed(2)}× {zoom < 1 ? "(letterboxed)" : zoom > 1 ? "(tighter crop)" : "(default cover)"}
            </span>
          </div>
          <input
            type="range"
            min={0.5}
            max={2}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-full"
          />
          <div className="flex justify-between text-[10px] text-[color:var(--muted)] mt-1">
            <span>0.5× — show whole photo</span>
            <span>1.0× — fill (default)</span>
            <span>2.0× — zoomed in</span>
          </div>
        </div>
      </fieldset>

      <fieldset className="border border-[color:var(--rule)] rounded p-4 space-y-3">
        <legend className="text-[11px] tracking-[.22em] uppercase font-bold text-navy px-1">
          Photo focal point — Mobile (4:5)
        </legend>
        <input type="hidden" name="mobile_focal_point" value={mobileObjectPosition} />
        <div className="grid sm:grid-cols-[280px_1fr] gap-4">
          <div className="space-y-2">
            <select
              value={mobileFocalMode}
              onChange={(e) => setMobileFocalMode(e.target.value as FocalMode)}
              className="w-full border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white"
            >
              <option value="top">Top — keep the top, crop bottom</option>
              <option value="center">Center — crop top and bottom equally</option>
              <option value="bottom">Bottom — keep the bottom, crop top</option>
              <option value="custom">Custom — pick exact X/Y</option>
            </select>
            {mobileFocalMode === "custom" && (
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="block text-[10px] tracking-[.18em] uppercase font-bold text-[color:var(--muted)] mb-1">X (%)</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    value={mobileFocalX}
                    onChange={(e) => setMobileFocalX(clamp(Number(e.target.value), 0, 100))}
                    className="w-full border border-[color:var(--rule)] rounded px-2 py-1.5 text-sm bg-white"
                  />
                </label>
                <label className="block">
                  <span className="block text-[10px] tracking-[.18em] uppercase font-bold text-[color:var(--muted)] mb-1">Y (%)</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    value={mobileFocalY}
                    onChange={(e) => setMobileFocalY(clamp(Number(e.target.value), 0, 100))}
                    className="w-full border border-[color:var(--rule)] rounded px-2 py-1.5 text-sm bg-white"
                  />
                </label>
              </div>
            )}
            <div className="border-t border-[color:var(--rule)] pt-2">
              <input type="hidden" name="mobile_zoom" value={mobileZoom.toFixed(2)} />
              <div className="flex items-baseline justify-between mb-1">
                <span className="text-[10px] tracking-[.18em] uppercase font-bold text-navy">Mobile zoom</span>
                <span className="text-xs text-[color:var(--muted)] font-mono">{mobileZoom.toFixed(2)}×</span>
              </div>
              <input
                type="range"
                min={0.5}
                max={2}
                step={0.05}
                value={mobileZoom}
                onChange={(e) => setMobileZoom(Number(e.target.value))}
                className="w-full"
              />
            </div>
          </div>
          <MobileFocalPreview
            src={previewSrc}
            objectPosition={mobileObjectPosition}
            zoom={mobileZoom}
            onPick={(x, y) => {
              setMobileFocalMode("custom");
              setMobileFocalX(Math.round(x));
              setMobileFocalY(Math.round(y));
            }}
          />
        </div>
      </fieldset>

      <fieldset className="border border-[color:var(--rule)] rounded p-4 space-y-3">
        <legend className="text-[11px] tracking-[.22em] uppercase font-bold text-navy px-1">
          Show more photos from this event
        </legend>
        <input
          type="hidden"
          name="extra_image_settings"
          value={JSON.stringify(extras)}
        />
        {maxExtras === 0 ? (
          <p className="text-xs text-[color:var(--muted)]">
            Save the slide with a linked event first. Then come back here
            to pull additional photos from the event&rsquo;s gallery.
          </p>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <span className="font-semibold">Additional images:</span>
                <input
                  type="number"
                  min={0}
                  max={maxExtras}
                  value={extras.length}
                  onChange={(e) => setExtraCount(Number(e.target.value))}
                  className="w-[64px] border border-[color:var(--rule)] rounded px-2 py-1 text-sm bg-white"
                />
                <span className="text-xs text-[color:var(--muted)]">
                  (up to {maxExtras} available in the event gallery)
                </span>
              </label>
            </div>
            {extras.length > 0 && (
              <div className="space-y-3">
                {extras.map((ex, i) => {
                  const photo = extraGalleryPhotos[i];
                  if (!photo) return null;
                  return (
                    <ExtraImageCard
                      key={`${photo.id}-${i}`}
                      index={i}
                      photoUrl={photo.url}
                      setting={ex}
                      onChange={(patch) => updateExtra(i, patch)}
                    />
                  );
                })}
              </div>
            )}
          </>
        )}
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

function MobileFocalPreview({
  src, objectPosition, zoom, onPick,
}: {
  src: string | null;
  objectPosition: string;
  zoom: number;
  onPick: (xPct: number, yPct: number) => void;
}) {
  if (!src) {
    return (
      <div className="flex items-center justify-center text-xs text-[color:var(--muted)] border border-dashed border-[color:var(--rule)] rounded p-4 min-h-[120px]">
        Pick an image URL or link an event to preview the crop.
      </div>
    );
  }
  const isContain = zoom < 1;
  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={(e) => {
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          const x = ((e.clientX - rect.left) / rect.width) * 100;
          const y = ((e.clientY - rect.top) / rect.height) * 100;
          onPick(clamp(x, 0, 100), clamp(y, 0, 100));
        }}
        className="block relative bg-[color:var(--navy-ink)] overflow-hidden rounded cursor-crosshair border border-[color:var(--rule)] mx-auto"
        style={{ aspectRatio: "4 / 5", width: "min(100%, 220px)" }}
        aria-label="Click to set mobile focal point"
      >
        <Image
          src={src}
          alt=""
          fill
          sizes="220px"
          className={`pointer-events-none ${isContain ? "object-contain" : "object-cover"}`}
          style={{
            objectPosition,
            transform: zoom !== 1 ? `scale(${zoom})` : undefined,
            transformOrigin: objectPosition,
          }}
        />
      </button>
      <div className="text-[10px] text-[color:var(--muted)] tracking-[.16em] uppercase text-center">
        Mobile preview · {objectPosition} · {zoom.toFixed(2)}×
      </div>
    </div>
  );
}

function ExtraImageCard({
  index, photoUrl, setting, onChange,
}: {
  index: number;
  photoUrl: string;
  setting: ExtraImageSetting;
  onChange: (patch: Partial<ExtraImageSetting>) => void;
}) {
  const focal = parseFocalPoint(setting.focal_point);
  const objectPosition = focalPointValue(focal.mode, focal.x, focal.y);
  const mobileFocal = parseFocalPoint(setting.mobile_focal_point);
  const mobileObjectPosition = focalPointValue(mobileFocal.mode, mobileFocal.x, mobileFocal.y);
  const isContain = setting.zoom < 1;
  const isMobileContain = setting.mobile_zoom < 1;
  return (
    <div className="border border-[color:var(--rule)] rounded p-3 bg-[color:var(--ivory)]/30 space-y-3">
      <div className="text-[10px] tracking-[.22em] uppercase font-bold text-[color:var(--muted)]">
        Image #{index + 2} from gallery
      </div>

      <CalibrationRow
        label="Desktop (21:9)"
        photoUrl={photoUrl}
        previewAspect="21 / 9"
        previewWidth="100%"
        objectPosition={objectPosition}
        zoom={setting.zoom}
        isContain={isContain}
        focalMode={focal.mode}
        onModeChange={(mode) => onChange({ focal_point: focalPointValue(mode, focal.x, focal.y) })}
        onPick={(x, y) => onChange({ focal_point: `${Math.round(clamp(x, 0, 100))}% ${Math.round(clamp(y, 0, 100))}%` })}
        onZoom={(z) => onChange({ zoom: z })}
      />

      <CalibrationRow
        label="Mobile (4:5)"
        photoUrl={photoUrl}
        previewAspect="4 / 5"
        previewWidth="160px"
        objectPosition={mobileObjectPosition}
        zoom={setting.mobile_zoom}
        isContain={isMobileContain}
        focalMode={mobileFocal.mode}
        onModeChange={(mode) =>
          onChange({ mobile_focal_point: focalPointValue(mode, mobileFocal.x, mobileFocal.y) })
        }
        onPick={(x, y) =>
          onChange({
            mobile_focal_point: `${Math.round(clamp(x, 0, 100))}% ${Math.round(clamp(y, 0, 100))}%`,
          })
        }
        onZoom={(z) => onChange({ mobile_zoom: z })}
      />
    </div>
  );
}

function CalibrationRow({
  label, photoUrl, previewAspect, previewWidth,
  objectPosition, zoom, isContain, focalMode,
  onModeChange, onPick, onZoom,
}: {
  label: string;
  photoUrl: string;
  previewAspect: string;
  previewWidth: string;
  objectPosition: string;
  zoom: number;
  isContain: boolean;
  focalMode: FocalMode;
  onModeChange: (mode: FocalMode) => void;
  onPick: (x: number, y: number) => void;
  onZoom: (z: number) => void;
}) {
  return (
    <div>
      <div className="text-[10px] tracking-[.18em] uppercase font-bold text-navy mb-1.5">{label}</div>
      <div className="grid sm:grid-cols-[1fr_180px] gap-3 items-start">
        <div className="space-y-2">
          <select
            value={focalMode}
            onChange={(e) => onModeChange(e.target.value as FocalMode)}
            className="w-full border border-[color:var(--rule)] rounded px-2 py-1.5 text-sm bg-white"
          >
            <option value="top">Top</option>
            <option value="center">Center</option>
            <option value="bottom">Bottom</option>
            <option value="custom">Custom (click preview)</option>
          </select>
          <div className="flex items-baseline justify-between text-[10px] text-[color:var(--muted)]">
            <span>Zoom</span>
            <span className="font-mono">{zoom.toFixed(2)}×</span>
          </div>
          <input
            type="range"
            min={0.5}
            max={2}
            step={0.05}
            value={zoom}
            onChange={(e) => onZoom(Number(e.target.value))}
            className="w-full"
          />
        </div>
        <button
          type="button"
          onClick={(e) => {
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * 100;
            const y = ((e.clientY - rect.top) / rect.height) * 100;
            onPick(clamp(x, 0, 100), clamp(y, 0, 100));
          }}
          className="block relative bg-[color:var(--navy-ink)] overflow-hidden rounded cursor-crosshair border border-[color:var(--rule)] mx-auto"
          style={{ aspectRatio: previewAspect, width: previewWidth }}
          aria-label="Click to set focal point"
        >
          <Image
            src={photoUrl}
            alt=""
            fill
            sizes="200px"
            className={`pointer-events-none ${isContain ? "object-contain" : "object-cover"}`}
            style={{
              objectPosition,
              transform: zoom !== 1 ? `scale(${zoom})` : undefined,
              transformOrigin: objectPosition,
            }}
          />
        </button>
      </div>
    </div>
  );
}

function clamp(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}

function FocalPreview({
  src, objectPosition, zoom, onPick,
}: {
  src: string | null;
  objectPosition: string;
  zoom: number;
  onPick: (xPct: number, yPct: number) => void;
}) {
  if (!src) {
    return (
      <div className="flex items-center justify-center text-xs text-[color:var(--muted)] border border-dashed border-[color:var(--rule)] rounded p-4 min-h-[120px]">
        Pick an image URL or link an event to preview the crop.
      </div>
    );
  }
  // Below 1.0, switch to contain so the whole photo shows + scales smaller.
  // At/above 1.0, stay on cover and scale up via transform.
  const isContain = zoom < 1;
  return (
    <div className="space-y-1">
      {/* Desktop hero crop: 21:9, on dark bg so letterbox is visible */}
      <button
        type="button"
        onClick={(e) => {
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          const x = ((e.clientX - rect.left) / rect.width) * 100;
          const y = ((e.clientY - rect.top) / rect.height) * 100;
          onPick(clamp(x, 0, 100), clamp(y, 0, 100));
        }}
        className="block relative w-full bg-[color:var(--navy-ink)] overflow-hidden rounded cursor-crosshair border border-[color:var(--rule)]"
        style={{ aspectRatio: "21 / 9" }}
        aria-label="Click to set focal point"
      >
        <Image
          src={src}
          alt=""
          fill
          sizes="(min-width: 768px) 480px, 100vw"
          className={`pointer-events-none ${isContain ? "object-contain" : "object-cover"}`}
          style={{
            objectPosition,
            transform: zoom !== 1 ? `scale(${zoom})` : undefined,
            transformOrigin: objectPosition,
          }}
        />
      </button>
      <div className="text-[10px] text-[color:var(--muted)] tracking-[.16em] uppercase">
        Desktop crop preview · {objectPosition} · {zoom.toFixed(2)}×
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
