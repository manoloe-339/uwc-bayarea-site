"use client";

import { useState } from "react";

export interface HostAlumnus {
  id: number;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  uwc_college: string | null;
  grad_year: number | null;
}

interface Props {
  /** Form field name for the hidden alumni_id input. */
  name: string;
  /** Human-readable slot label (e.g., "Host 1"). */
  label: string;
  /** Initial selection, fetched server-side via the join. */
  initial: HostAlumnus | null;
  /** When true, surfaces an "+ Add new (admin-only)" affordance that
   * creates a minimal alumni row tagged 'admin_added' and picks it.
   * Used by the homepage news-feature form so news subjects who aren't
   * part of the community can still be featured. */
  allowAdminAdd?: boolean;
}

/** Form-time alumni picker for Foodies host slots. Submits the selected
 * alumni id via a hidden input — does NOT persist on click; the parent
 * form's submit does that. */
export function FoodiesHostPicker({
  name,
  label,
  initial,
  allowAdminAdd = false,
}: Props) {
  const [selected, setSelected] = useState<HostAlumnus | null>(initial);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<HostAlumnus[]>([]);
  const [searching, setSearching] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState<string | null>(null);
  const [submittingCreate, setSubmittingCreate] = useState(false);

  const search = async (value: string) => {
    if (value.trim().length < 2) {
      setHits([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(
        `/api/admin/help-out/search-alumni?q=${encodeURIComponent(value)}`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { results: HostAlumnus[] };
      setHits(data.results);
    } finally {
      setSearching(false);
    }
  };

  const pick = (a: HostAlumnus) => {
    setSelected(a);
    setOpen(false);
    setQ("");
    setHits([]);
    setCreating(false);
    setCreateErr(null);
  };

  const clear = () => setSelected(null);

  const submitCreate = async (payload: Record<string, string>) => {
    setCreateErr(null);
    setSubmittingCreate(true);
    try {
      const res = await fetch("/api/admin/news/create-alumnus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { alumnus: HostAlumnus };
      pick(data.alumnus);
    } catch (e) {
      setCreateErr(e instanceof Error ? e.message : "Failed to create record");
    } finally {
      setSubmittingCreate(false);
    }
  };

  return (
    <div>
      <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-1">
        {label}
      </span>
      <input type="hidden" name={name} value={selected?.id ?? ""} />

      {selected ? (
        <div className="flex items-center justify-between gap-3 border border-[color:var(--rule)] rounded px-3 py-2 bg-white">
          <div className="min-w-0">
            <div className="font-semibold text-sm text-[color:var(--navy-ink)]">
              {[selected.first_name, selected.last_name].filter(Boolean).join(" ") ||
                "(no name)"}
            </div>
            <div className="text-xs text-[color:var(--muted)] truncate">
              {[selected.uwc_college, selected.grad_year].filter(Boolean).join(" · ") ||
                selected.email ||
                ""}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="text-xs font-semibold text-navy hover:underline"
            >
              Change
            </button>
            <button
              type="button"
              onClick={clear}
              className="text-xs text-[color:var(--muted)] hover:text-rose-700"
            >
              Clear
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full border border-dashed border-[color:var(--rule)] rounded px-3 py-2 text-sm text-left text-[color:var(--muted)] hover:border-navy hover:text-navy bg-white"
        >
          + Pick an alumnus…
        </button>
      )}

      {open && (
        <div className="mt-2 bg-white border border-[color:var(--rule)] rounded p-3">
          {!creating ? (
            <>
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="search"
                  value={q}
                  autoFocus
                  onChange={(e) => {
                    setQ(e.target.value);
                    void search(e.target.value);
                  }}
                  placeholder="Search alumni by name or email…"
                  className="flex-1 border border-[color:var(--rule)] rounded px-2 py-1.5 text-sm bg-white"
                />
                {allowAdminAdd && (
                  <button
                    type="button"
                    onClick={() => {
                      setCreating(true);
                      setCreateErr(null);
                    }}
                    className="text-xs font-semibold text-navy border border-navy rounded px-2.5 py-1.5 hover:bg-navy hover:text-white whitespace-nowrap"
                  >
                    + Add new
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setQ("");
                    setHits([]);
                  }}
                  className="text-xs text-[color:var(--muted)] hover:text-navy"
                >
                  Cancel
                </button>
              </div>
              {searching && (
                <div className="text-xs text-[color:var(--muted)] py-2">Searching…</div>
              )}
              {!searching && q.trim().length >= 2 && hits.length === 0 && (
                <div className="text-xs text-[color:var(--muted)] py-2">
                  No matches.
                  {allowAdminAdd && (
                    <>
                      {" "}
                      <button
                        type="button"
                        onClick={() => {
                          setCreating(true);
                          setCreateErr(null);
                        }}
                        className="font-semibold text-navy hover:underline"
                      >
                        Add new record for an alum not in the database →
                      </button>
                    </>
                  )}
                </div>
              )}
              {hits.length > 0 && (
                <ul className="divide-y divide-[color:var(--rule)] max-h-[280px] overflow-y-auto">
                  {hits.map((h) => {
                    const fullName =
                      [h.first_name, h.last_name].filter(Boolean).join(" ") || "(no name)";
                    const sub = [h.uwc_college, h.grad_year].filter(Boolean).join(" · ");
                    return (
                      <li
                        key={h.id}
                        className="py-2 flex items-start justify-between gap-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-sm text-[color:var(--navy-ink)]">
                            {fullName}
                          </div>
                          <div className="text-xs text-[color:var(--muted)]">
                            {h.email}
                            {sub && <span className="italic"> · {sub}</span>}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => pick(h)}
                          className="text-xs font-semibold text-white bg-navy px-3 py-1.5 rounded hover:opacity-90 whitespace-nowrap"
                        >
                          Pick
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          ) : (
            <AdminAddForm
              prefill={q}
              busy={submittingCreate}
              err={createErr}
              onSubmit={submitCreate}
              onCancel={() => {
                setCreating(false);
                setCreateErr(null);
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}

/** Inline mini-form to create an admin-added alumni row without leaving
 * the parent form.
 *
 * IMPORTANT: This used to render as a <form>, but the parent
 * NewsFeatureForm is itself a <form>. HTML disallows nested forms; the
 * browser hoisted any submit click here onto the OUTER form, causing
 * the entire news-feature form to submit with partial data and the
 * page to reload — which looked like "the data disappeared." We now
 * render a <div> with controlled inputs and a type="button" submit,
 * so the outer form is never accidentally submitted. */
function AdminAddForm({
  prefill,
  busy,
  err,
  onSubmit,
  onCancel,
}: {
  prefill: string;
  busy: boolean;
  err: string | null;
  onSubmit: (payload: Record<string, string>) => void | Promise<void>;
  onCancel: () => void;
}) {
  // Split the prefill string ("Jane Doe" → first/last) so the admin
  // doesn't retype the name they were just searching for.
  const trimmed = prefill.trim();
  const space = trimmed.indexOf(" ");
  const prefillFirst = space > 0 ? trimmed.slice(0, space) : trimmed;
  const prefillLast = space > 0 ? trimmed.slice(space + 1) : "";

  const [fields, setFields] = useState({
    first_name: prefillFirst,
    last_name: prefillLast,
    uwc_college: "",
    grad_year: "",
    photo_url: "",
    linkedin_url: "",
    current_title: "",
    current_company: "",
  });

  const set = (k: keyof typeof fields) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setFields((f) => ({ ...f, [k]: e.target.value }));

  // Enter on any of the inputs should submit, mirroring native form UX.
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (!busy && fields.first_name.trim() && fields.last_name.trim()) {
        void onSubmit(fields);
      }
    }
  };

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="text-[11px] tracking-[.22em] uppercase font-bold text-navy">
          Add new (admin-only record)
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-[color:var(--muted)] hover:text-navy"
        >
          Back to search
        </button>
      </div>
      <p className="text-xs text-[color:var(--muted)]">
        Tagged{" "}
        <code className="font-mono">admin_added</code> — excluded from
        community counts and email sends. Use for news-feature subjects
        who aren&rsquo;t part of the alumni community.
      </p>

      <div className="grid grid-cols-2 gap-2">
        <MiniField label="First name *" value={fields.first_name} onChange={set("first_name")} onKeyDown={onKeyDown} required />
        <MiniField label="Last name *" value={fields.last_name} onChange={set("last_name")} onKeyDown={onKeyDown} required />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <MiniField label="UWC college" value={fields.uwc_college} onChange={set("uwc_college")} onKeyDown={onKeyDown} placeholder="e.g. UWC Atlantic" />
        <MiniField label="Grad year" type="number" value={fields.grad_year} onChange={set("grad_year")} onKeyDown={onKeyDown} placeholder="e.g. 1987" />
      </div>
      <MiniField
        label="Photo URL"
        type="url"
        value={fields.photo_url}
        onChange={set("photo_url")}
        onKeyDown={onKeyDown}
        placeholder="https://… — leave blank to skip portrait"
      />
      <MiniField
        label="LinkedIn URL (optional)"
        type="url"
        value={fields.linkedin_url}
        onChange={set("linkedin_url")}
        onKeyDown={onKeyDown}
        placeholder="https://www.linkedin.com/in/…"
      />
      <div className="grid grid-cols-2 gap-2">
        <MiniField label="Current title" value={fields.current_title} onChange={set("current_title")} onKeyDown={onKeyDown} placeholder="e.g. Senior Analyst" />
        <MiniField label="Current company" value={fields.current_company} onChange={set("current_company")} onKeyDown={onKeyDown} placeholder="e.g. Goldman" />
      </div>

      {err && <div className="text-xs text-rose-700">{err}</div>}

      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-[color:var(--muted)] hover:text-navy"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={busy || !fields.first_name.trim() || !fields.last_name.trim()}
          onClick={() => void onSubmit(fields)}
          className="text-xs font-semibold text-white bg-navy px-3 py-1.5 rounded hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Creating…" : "Create & pick"}
        </button>
      </div>
    </div>
  );
}

function MiniField({
  label,
  value,
  onChange,
  onKeyDown,
  placeholder,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="block text-[10px] tracking-[.18em] uppercase font-semibold text-[color:var(--muted)] mb-0.5">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        required={required}
        className="w-full border border-[color:var(--rule)] rounded px-2 py-1.5 text-xs bg-white"
      />
    </label>
  );
}
