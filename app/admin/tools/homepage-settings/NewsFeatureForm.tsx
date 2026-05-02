"use client";

import Link from "next/link";
import { FoodiesHostPicker, type HostAlumnus } from "@/components/admin/FoodiesHostPicker";
import type { ArticleCardStyle } from "@/lib/news-features";

export interface NewsFeatureFormInitial {
  alumni: HostAlumnus | null;
  alumni_2: HostAlumnus | null;
  publication: string;
  date_label: string;
  pull_quote: string;
  article_url: string;
  article_title: string;
  article_image_url: string;
  article_card_style: ArticleCardStyle;
  portrait_override_url: string;
  current_role_override: string;
  sort_order: number;
  enabled: boolean;
}

interface Props {
  initial: NewsFeatureFormInitial;
  action: (formData: FormData) => void;
  submitLabel: string;
}

export default function NewsFeatureForm({ initial, action, submitLabel }: Props) {
  return (
    <form
      action={action}
      className="bg-white border border-[color:var(--rule)] rounded-[10px] p-5 space-y-4"
    >
      <FoodiesHostPicker
        name="alumni_id"
        label="Featured alumnus"
        initial={initial.alumni}
      />

      <FoodiesHostPicker
        name="alumni_id_2"
        label="Second alumnus (optional — for stories featuring two alumni together)"
        initial={initial.alumni_2}
      />

      <div className="grid sm:grid-cols-2 gap-4">
        <Field name="publication" label="Publication" defaultValue={initial.publication} placeholder="e.g. The Atlantic" />
        <Field name="date_label" label="Date label" defaultValue={initial.date_label} placeholder="e.g. April 2026" />
      </div>

      <TextareaField
        name="pull_quote"
        label="Pull quote (required)"
        rows={4}
        defaultValue={initial.pull_quote}
        required
        placeholder="The line from the article that does the heavy lifting…"
      />

      <Field
        name="article_url"
        label="Article URL"
        type="url"
        defaultValue={initial.article_url}
        placeholder="https://…"
      />

      <fieldset className="border border-[color:var(--rule)] rounded p-4 space-y-3">
        <legend className="text-[11px] tracking-[.22em] uppercase font-bold text-navy px-1">
          Article preview card (optional)
        </legend>
        <Field
          name="article_title"
          label="Article title"
          defaultValue={initial.article_title}
          placeholder="e.g. The fascinating history of eSwatini"
        />
        <Field
          name="article_image_url"
          label="Article preview image URL"
          type="url"
          defaultValue={initial.article_image_url}
          placeholder="Paste the og:image URL or a screenshot — leave blank to skip"
        />
        <label className="block">
          <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-1">
            Card style
          </span>
          <select
            name="article_card_style"
            defaultValue={initial.article_card_style}
            className="w-full sm:w-[320px] border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white"
          >
            <option value="clean">Clean — modern card with thin border + shadow</option>
            <option value="clipping">Clipping — slight rotation, paper feel</option>
          </select>
          <span className="block mt-1 text-xs text-[color:var(--muted)]">
            Tip: right-click the article&rsquo;s hero image and copy its URL,
            or grab the og:image from the page source. Card only appears
            when an image URL is set.
          </span>
        </label>
      </fieldset>

      <Field
        name="portrait_override_url"
        label="Portrait URL override (leave blank to use alumni record's photo)"
        type="url"
        defaultValue={initial.portrait_override_url}
        placeholder="https://…"
      />

      <Field
        name="current_role_override"
        label="Current role line (leave blank to auto-fill from alumni record)"
        defaultValue={initial.current_role_override}
        placeholder="e.g. Senior Analyst at Goldman Sachs"
      />

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

      <p className="text-xs text-[color:var(--muted)]">
        Layout is auto-picked from the number of enabled features:
        <br />
        1 enabled → spotlight (portrait + big quote) · 2 enabled → side-by-side pair · 0 → section hidden.
      </p>

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
  name, label, defaultValue, type = "text", placeholder,
}: {
  name: string; label: string; defaultValue?: string; type?: string; placeholder?: string;
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
        placeholder={placeholder}
        className="w-full border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white"
      />
    </label>
  );
}

function TextareaField({
  name, label, rows, defaultValue, required, placeholder,
}: {
  name: string; label: string; rows?: number; defaultValue?: string;
  required?: boolean; placeholder?: string;
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
        required={required}
        placeholder={placeholder}
        className="w-full border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white"
      />
    </label>
  );
}
