"use client";

import { useState } from "react";
import { FoodiesHostPicker, type HostAlumnus } from "@/components/admin/FoodiesHostPicker";

export interface FeaturedAlumnusEntry {
  alumni: HostAlumnus;
  role_label: string;
}

interface Props {
  /** Form field name for the JSON-serialised list. */
  name: string;
  initial: FeaturedAlumnusEntry[];
}

export function FeaturedAlumniManager({ name, initial }: Props) {
  const [entries, setEntries] = useState<FeaturedAlumnusEntry[]>(initial);

  const serialized = JSON.stringify(
    entries.map((e) => ({
      alumni_id: e.alumni.id,
      role_label: e.role_label.trim() || null,
    }))
  );

  const addEntry = (alumnus: HostAlumnus) => {
    if (entries.some((e) => e.alumni.id === alumnus.id)) return;
    setEntries((prev) => [...prev, { alumni: alumnus, role_label: "" }]);
  };

  const removeEntry = (alumniId: number) => {
    setEntries((prev) => prev.filter((e) => e.alumni.id !== alumniId));
  };

  const updateRoleLabel = (alumniId: number, role_label: string) => {
    setEntries((prev) =>
      prev.map((e) => (e.alumni.id === alumniId ? { ...e, role_label } : e))
    );
  };

  const move = (alumniId: number, direction: -1 | 1) => {
    setEntries((prev) => {
      const idx = prev.findIndex((e) => e.alumni.id === alumniId);
      if (idx < 0) return prev;
      const target = idx + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  return (
    <div>
      <input type="hidden" name={name} value={serialized} />

      {entries.length === 0 ? (
        <p className="text-xs text-[color:var(--muted)] mb-3">
          No featured alumni yet. Pick one below.
        </p>
      ) : (
        <ul className="space-y-2 mb-3">
          {entries.map((e, i) => (
            <li
              key={e.alumni.id}
              className="bg-white border border-[color:var(--rule)] rounded p-3"
            >
              <div className="flex items-start gap-3">
                <div className="flex flex-col gap-1 pt-0.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => move(e.alumni.id, -1)}
                    disabled={i === 0}
                    className="text-xs text-[color:var(--muted)] hover:text-navy disabled:opacity-30 disabled:cursor-not-allowed"
                    aria-label="Move up"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => move(e.alumni.id, 1)}
                    disabled={i === entries.length - 1}
                    className="text-xs text-[color:var(--muted)] hover:text-navy disabled:opacity-30 disabled:cursor-not-allowed"
                    aria-label="Move down"
                  >
                    ↓
                  </button>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-[color:var(--navy-ink)]">
                    {[e.alumni.first_name, e.alumni.last_name].filter(Boolean).join(" ") || "(no name)"}
                  </div>
                  <div className="text-xs text-[color:var(--muted)]">
                    {[e.alumni.uwc_college, e.alumni.grad_year].filter(Boolean).join(" · ")}
                  </div>
                  <label className="block mt-2">
                    <span className="block text-[10px] tracking-[.18em] uppercase font-bold text-[color:var(--muted)] mb-1">
                      Role label (optional — overrides current job title)
                    </span>
                    <input
                      type="text"
                      value={e.role_label}
                      onChange={(ev) => updateRoleLabel(e.alumni.id, ev.target.value)}
                      placeholder="e.g. Guest speaker, Co-host, Lead organizer"
                      className="w-full border border-[color:var(--rule)] rounded px-2 py-1.5 text-sm bg-white"
                    />
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => removeEntry(e.alumni.id)}
                  className="text-xs text-rose-700 hover:underline shrink-0"
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <FeaturedAlumniAddPicker onAdd={addEntry} excludedIds={entries.map((e) => e.alumni.id)} />
    </div>
  );
}

/** Inline picker that adds to the parent list (rather than setting a
 * single hidden input value, like FoodiesHostPicker does). */
function FeaturedAlumniAddPicker({
  onAdd, excludedIds,
}: {
  onAdd: (a: HostAlumnus) => void;
  excludedIds: number[];
}) {
  // Reuse the FoodiesHostPicker's UI, but intercept selection: track
  // the current pick in local state, and when it changes (and is not
  // already in the list) hand it off to onAdd then reset.
  const [pickerKey, setPickerKey] = useState(0);
  return (
    <div>
      <FoodiesHostPickerWrapper
        key={pickerKey}
        excludedIds={excludedIds}
        onPicked={(a) => {
          onAdd(a);
          // Force the picker to reset for the next add.
          setPickerKey((k) => k + 1);
        }}
      />
    </div>
  );
}

/** Tiny wrapper around FoodiesHostPicker that calls onPicked when the
 * user selects someone, instead of leaving the chosen value in the
 * picker's chip. The hidden alumni_id input it writes is unused here
 * (the parent serializes its own list state). */
function FoodiesHostPickerWrapper({
  excludedIds, onPicked,
}: {
  excludedIds: number[];
  onPicked: (a: HostAlumnus) => void;
}) {
  // We bridge the picker's onChange via a controlled parent: render
  // the picker, then watch its hidden input via a ref. Simpler path —
  // just expose a "Pick" button that opens the picker and calls onPicked.
  // FoodiesHostPicker doesn't expose onPicked, so we shim by wrapping
  // its initial state and reading the hidden field via FormData on a
  // local form. Cleanest: re-implement the small portion we need.
  return (
    <InlineAlumniSearch onPicked={onPicked} excludedIds={excludedIds} />
  );
}

/** Standalone alumni search/picker that calls onPicked on selection.
 * Reuses the same /api/admin/help-out/search-alumni endpoint as the
 * Foodies host picker. */
function InlineAlumniSearch({
  onPicked, excludedIds,
}: {
  onPicked: (a: HostAlumnus) => void;
  excludedIds: number[];
}) {
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
      setHits(data.results.filter((r) => !excludedIds.includes(r.id)));
    } finally {
      setSearching(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full border border-dashed border-[color:var(--rule)] rounded px-3 py-2 text-sm text-left text-[color:var(--muted)] hover:border-navy hover:text-navy bg-white"
      >
        + Add a featured alumnus…
      </button>
    );
  }

  return (
    <div className="bg-white border border-[color:var(--rule)] rounded p-3">
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
      {searching && <div className="text-xs text-[color:var(--muted)] py-2">Searching…</div>}
      {!searching && q.trim().length >= 2 && hits.length === 0 && (
        <div className="text-xs text-[color:var(--muted)] py-2">No matches.</div>
      )}
      {hits.length > 0 && (
        <ul className="divide-y divide-[color:var(--rule)] max-h-[280px] overflow-y-auto">
          {hits.map((h) => (
            <li key={h.id} className="py-2 flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-sm text-[color:var(--navy-ink)]">
                  {[h.first_name, h.last_name].filter(Boolean).join(" ") || "(no name)"}
                </div>
                <div className="text-xs text-[color:var(--muted)]">
                  {h.email}
                  {[h.uwc_college, h.grad_year].filter(Boolean).join(" · ") && (
                    <span className="italic">
                      {" "}
                      · {[h.uwc_college, h.grad_year].filter(Boolean).join(" · ")}
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  onPicked(h);
                  setQ("");
                  setHits([]);
                  setOpen(false);
                }}
                className="text-xs font-semibold text-white bg-navy px-3 py-1.5 rounded hover:opacity-90 whitespace-nowrap"
              >
                Add
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
