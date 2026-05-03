"use client";

import { useState, useTransition } from "react";
import { bulkCheckInAttendees, type BulkCheckInRef } from "./actions";
import { namesEffectivelyMatch } from "@/lib/name-similarity";

export interface PendingAttendee {
  kind: "attendee" | "name_tag";
  row_id: number;
  amount_paid: string;
  purchaser_name: string | null;
  purchaser_email: string | null;
  alumni_name: string | null;
  alumni_email: string | null;
  name_tag_name: string | null;
}

interface Props {
  eventId: number;
  slug: string;
  attendees: PendingAttendee[];
}

/** Composite key the client uses to select rows (kind|row_id). */
function rowKey(a: PendingAttendee): string {
  return `${a.kind}|${a.row_id}`;
}

export function BulkCheckInList({ eventId, slug, attendees }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    setSavedCount(null);
  };

  const selectAll = () => {
    setSelected(new Set(attendees.map(rowKey)));
    setSavedCount(null);
  };

  const clearAll = () => {
    setSelected(new Set());
    setSavedCount(null);
  };

  const submit = () => {
    setError(null);
    setSavedCount(null);
    const refs: BulkCheckInRef[] = Array.from(selected)
      .map((key) => {
        const [kind, idStr] = key.split("|");
        const id = Number(idStr);
        if ((kind !== "attendee" && kind !== "name_tag") || !Number.isFinite(id)) return null;
        return { kind: kind as BulkCheckInRef["kind"], id };
      })
      .filter((x): x is BulkCheckInRef => x !== null);
    startTransition(async () => {
      const result = await bulkCheckInAttendees(eventId, slug, refs);
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
          const key = rowKey(a);
          const isSelected = selected.has(key);
          // Primary: name tag if set (that's what they wear at the event),
          //          else alumni name (matched record), else purchaser name.
          const primary =
            a.name_tag_name ?? a.alumni_name ?? a.purchaser_name ?? `#${a.row_id}`;
          // For guest attendees (name tag != linked alum), show the
          // alum as sponsor. Purchaser line is suppressed when the
          // purchaser email matches the alum's — the alum line covers
          // buyer identity in that case (handles Stripe billing-name
          // quirks like "manoloe-7070's projects").
          const nameTagIsGuest =
            !!a.name_tag_name &&
            !!a.alumni_name &&
            !namesEffectivelyMatch(a.name_tag_name, a.alumni_name);
          const sameByEmail =
            !!a.purchaser_email &&
            !!a.alumni_email &&
            a.purchaser_email.trim().toLowerCase() ===
              a.alumni_email.trim().toLowerCase();
          const secondaryParts: string[] = [];
          if (nameTagIsGuest && a.alumni_name) {
            secondaryParts.push(`alum: ${a.alumni_name}`);
          }
          if (
            !sameByEmail &&
            a.purchaser_name &&
            !namesEffectivelyMatch(a.purchaser_name, primary) &&
            !namesEffectivelyMatch(a.purchaser_name, a.alumni_name ?? "") &&
            !namesEffectivelyMatch(a.purchaser_name, a.name_tag_name ?? "")
          ) {
            secondaryParts.push(`purchaser: ${a.purchaser_name}`);
          }
          if (a.kind === "name_tag") {
            secondaryParts.push("standalone name tag");
          }
          return (
            <li key={key}>
              <label
                className={`flex items-center justify-between gap-3 px-2 py-1.5 rounded cursor-pointer ${
                  isSelected ? "bg-green-50" : "hover:bg-ivory-2"
                }`}
              >
                <span className="flex items-center gap-2.5 min-w-0 flex-1">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggle(key)}
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
                  {a.kind === "name_tag"
                    ? "VIP/comp"
                    : `Paid $${Number(a.amount_paid || 0).toFixed(0)}`}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
