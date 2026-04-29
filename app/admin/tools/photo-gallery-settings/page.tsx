import Link from "next/link";
import { getSiteSettings, DEFAULT_PHOTO_GALLERY_INTRO } from "@/lib/settings";
import { savePhotoGallerySettings } from "./actions";

export const dynamic = "force-dynamic";

export default async function PhotoGallerySettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const sp = await searchParams;
  const s = await getSiteSettings();

  return (
    <div className="max-w-[760px]">
      <div className="mb-2 text-sm text-[color:var(--muted)]">
        <Link href="/admin/tools" className="hover:text-navy underline">
          Admin tools
        </Link>{" "}
        &rarr; Photo galleries
      </div>
      <div className="flex items-baseline justify-between mb-4">
        <div>
          <h1 className="font-sans text-4xl font-bold text-[color:var(--navy-ink)]">
            Photo gallery settings
          </h1>
          <p className="text-[color:var(--muted)] text-sm">
            Controls the public{" "}
            <Link href="/photos" className="text-navy underline">
              /photos
            </Link>{" "}
            page layout and the Present-mode slideshow.
          </p>
        </div>
      </div>

      {sp.saved && (
        <div className="mb-5 p-3 bg-ivory-2 border-l-4 border-navy rounded-[2px] text-sm">
          Saved.
        </div>
      )}

      <form
        action={savePhotoGallerySettings}
        className="bg-white border border-[color:var(--rule)] rounded-[10px] p-6 space-y-8"
      >
        <Section title="Intro band copy">
          <div className="space-y-5">
            <TextField
              label="Eyebrow (small uppercase line above the headline)"
              name="intro_eyebrow"
              defaultValue={s.photo_gallery_intro_eyebrow ?? DEFAULT_PHOTO_GALLERY_INTRO.eyebrow}
              hint='Auto-uppercased on the page. e.g. "Photographs · 1976 — present".'
            />
            <div className="grid sm:grid-cols-2 gap-4">
              <TextField
                label="Headline (regular)"
                name="intro_headline"
                defaultValue={s.photo_gallery_intro_headline ?? DEFAULT_PHOTO_GALLERY_INTRO.headline}
                hint='The dark first part. e.g. "A community,".'
              />
              <TextField
                label="Headline accent (italic blue)"
                name="intro_headline_accent"
                defaultValue={
                  s.photo_gallery_intro_headline_accent ?? DEFAULT_PHOTO_GALLERY_INTRO.headlineAccent
                }
                hint='The italic blue tail. e.g. "in pictures".'
              />
            </div>
            <TextareaField
              label="Subheading"
              name="intro_subhead"
              defaultValue={s.photo_gallery_intro_subhead ?? DEFAULT_PHOTO_GALLERY_INTRO.subhead}
              rows={3}
              hint="The paragraph under the headline. Leave blank to hide it."
            />
          </div>
        </Section>

        <Section title="Layout">
          <div className="space-y-5">
            <NumberField
              label="Thumbnails per gallery row (desktop)"
              name="thumbs_per_row"
              defaultValue={s.photo_gallery_thumbs_per_row}
              min={3}
              max={5}
              hint="Mobile always shows 2 columns. The last thumbnail becomes a “+N more” overlay when there are more photos in the gallery."
            />
            <Toggle
              label="Show page intro band"
              name="show_intro"
              defaultChecked={s.photo_gallery_show_intro}
              hint="The “A community, in pictures” headline above the marquee."
            />
            <Toggle
              label="Pause marquee scrolling"
              name="marquee_paused"
              defaultChecked={s.photo_gallery_marquee_paused}
              hint="Stops the auto-scrolling photo strip at the top of the page."
            />
          </div>
        </Section>

        <Section title="Present mode">
          <NumberField
            label="Seconds per slide"
            name="slide_duration_sec"
            defaultValue={s.photo_gallery_slide_duration_sec}
            min={2}
            max={60}
            hint="How long each photo lingers before the next one fades in. Range: 2–60 seconds."
          />
        </Section>

        <div className="pt-4 border-t border-[color:var(--rule)]">
          <button
            type="submit"
            className="bg-navy text-white px-5 py-2.5 rounded text-sm font-semibold tracking-wide"
          >
            Save changes
          </button>
        </div>
      </form>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-3">
        {title}
      </h2>
      {children}
    </section>
  );
}

function TextField({
  label,
  name,
  defaultValue,
  hint,
}: {
  label: string;
  name: string;
  defaultValue: string;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-[color:var(--muted)] mb-1">
        {label}
      </span>
      <input
        type="text"
        name={name}
        defaultValue={defaultValue}
        className="w-full border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white"
      />
      {hint && <span className="block text-xs text-[color:var(--muted)] mt-1">{hint}</span>}
    </label>
  );
}

function TextareaField({
  label,
  name,
  defaultValue,
  rows = 3,
  hint,
}: {
  label: string;
  name: string;
  defaultValue: string;
  rows?: number;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-[color:var(--muted)] mb-1">
        {label}
      </span>
      <textarea
        name={name}
        defaultValue={defaultValue}
        rows={rows}
        className="w-full border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white font-sans"
      />
      {hint && <span className="block text-xs text-[color:var(--muted)] mt-1">{hint}</span>}
    </label>
  );
}

function NumberField({
  label,
  name,
  defaultValue,
  min,
  max,
  hint,
}: {
  label: string;
  name: string;
  defaultValue: number;
  min: number;
  max: number;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-[color:var(--muted)] mb-1">
        {label}
      </span>
      <input
        type="number"
        name={name}
        defaultValue={defaultValue}
        min={min}
        max={max}
        className="w-32 border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white"
      />
      {hint && <span className="block text-xs text-[color:var(--muted)] mt-1">{hint}</span>}
    </label>
  );
}

function Toggle({
  label,
  name,
  defaultChecked,
  hint,
}: {
  label: string;
  name: string;
  defaultChecked: boolean;
  hint?: string;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        value="1"
        className="mt-1 h-4 w-4 accent-navy"
      />
      <span>
        <span className="block text-sm font-semibold text-[color:var(--navy-ink)]">{label}</span>
        {hint && (
          <span className="block text-xs text-[color:var(--muted)] mt-0.5">{hint}</span>
        )}
      </span>
    </label>
  );
}
