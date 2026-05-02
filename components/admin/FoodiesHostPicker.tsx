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
}

/** Form-time alumni picker for Foodies host slots. Submits the selected
 * alumni id via a hidden input — does NOT persist on click; the parent
 * form's submit does that. */
export function FoodiesHostPicker({ name, label, initial }: Props) {
  const [selected, setSelected] = useState<HostAlumnus | null>(initial);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<HostAlumnus[]>([]);
  const [searching, setSearching] = useState(false);

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
  };

  const clear = () => setSelected(null);

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
            <div className="text-xs text-[color:var(--muted)] py-2">No matches.</div>
          )}
          {hits.length > 0 && (
            <ul className="divide-y divide-[color:var(--rule)] max-h-[280px] overflow-y-auto">
              {hits.map((h) => {
                const fullName =
                  [h.first_name, h.last_name].filter(Boolean).join(" ") || "(no name)";
                const sub = [h.uwc_college, h.grad_year].filter(Boolean).join(" · ");
                return (
                  <li key={h.id} className="py-2 flex items-start justify-between gap-3">
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
        </div>
      )}
    </div>
  );
}
