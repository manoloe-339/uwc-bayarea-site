"use client";

import { useState, useTransition } from "react";
import { bulkCheckInAttendees } from "./actions";

export interface PendingAttendee {
  id: number;
  amount_paid: string;
  purchaser_name: string | null;
  alumni_name: string | null;
  name_tag_name: string | null;
}

interface Props {
  eventId: number;
  slug: string;
  attendees: PendingAttendee[];
}

export function BulkCheckInList({ eventId, slug, attendees }: Props) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setSavedCount(null);
  };

  const selectAll = () => {
    setSelected(new Set(attendees.map((a) => a.id)));
    setSavedCount(null);
  };

  const clearAll = () => {
    setSelected(new Set());
    setSavedCount(null);
  };

  const submit = () => {
    setError(null);
    setSavedCount(null);
    const ids = Array.from(selected);
    startTransition(async () => {
      const result = await bulkCheckInAttendees(eventId, slug, ids);
      if (result.ok) {
        setSavedCount(result.count);
        setSelected(new Set());
      } else {
        setError(result.error ?? "Save failed");
      }
    });
  };

  if (attendees.length === 0) {
    return <p className="text-sm text-[color:var(--muted)]">Everyone&rsquo;s in. 🎉</p>;
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3 text-xs">
        <div className="flex gap-3 text-[color:var(--muted)]">
          <button
            type="button"
            onClick={selectAll}
            className="font-semibold hover:text-navy"
          >
            Select all
          </button>
          {selected.size > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="font-semibold hover:text-navy"
            >
              Clear ({selected.size})
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={submit}
          disabled={isPending || selected.size === 0}
          className="bg-navy text-white px-4 py-2 rounded text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isPending
            ? "Saving…"
            : selected.size === 0
              ? "Check in selected"
              : `✓ Check in ${selected.size}`}
        </button>
      </div>

      {error && (
        <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 text-red-900 text-xs rounded">
          {error}
        </div>
      )}
      {savedCount !== null && (
        <div className="mb-3 px-3 py-2 bg-green-50 border border-green-200 text-green-900 text-xs rounded">
          ✓ Checked in {savedCount} {savedCount === 1 ? "attendee" : "attendees"}.
        </div>
      )}

      <ul className="space-y-1 text-sm">
        {attendees.map((a) => {
          const isSelected = selected.has(a.id);
          // Primary: name tag if set (that's what they wear at the event),
          //          else alumni name (matched record), else purchaser name.
          const primary =
            a.name_tag_name ?? a.alumni_name ?? a.purchaser_name ?? `#${a.id}`;
          // Show purchaser as secondary when it differs from the primary —
          // helps spot tickets bought by one person for another.
          const secondaryParts: string[] = [];
          if (
            a.name_tag_name &&
            a.alumni_name &&
            a.alumni_name !== a.name_tag_name
          ) {
            secondaryParts.push(`alum: ${a.alumni_name}`);
          }
          if (
            a.purchaser_name &&
            a.purchaser_name !== a.name_tag_name &&
            a.purchaser_name !== a.alumni_name
          ) {
            secondaryParts.push(`purchaser: ${a.purchaser_name}`);
          }
          return (
            <li key={a.id}>
              <label
                className={`flex items-center justify-between gap-3 px-2 py-1.5 rounded cursor-pointer ${
                  isSelected ? "bg-green-50" : "hover:bg-ivory-2"
                }`}
              >
                <span className="flex items-center gap-2.5 min-w-0 flex-1">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggle(a.id)}
                    className="w-4 h-4 shrink-0 accent-navy"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[color:var(--navy-ink)]">
                      {primary}
                    </span>
                    {secondaryParts.length > 0 && (
                      <span className="block text-[11px] text-[color:var(--muted)] truncate">
                        {secondaryParts.join(" · ")}
                      </span>
                    )}
                  </span>
                </span>
                <span className="text-xs text-[color:var(--muted)] tabular-nums shrink-0">
                  Paid ${Number(a.amount_paid || 0).toFixed(0)}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
