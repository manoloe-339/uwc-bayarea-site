"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import SavedRow from "./SavedRow";
import {
  SAVE_STATUSES,
  STATUS_LABELS,
  type SaveReason,
  type SaveStatus,
} from "@/lib/directory-saves-shared";

type PendingUndo = {
  alumniId: number;
  prev: { status: SaveStatus; reason: SaveReason | null; note: string | null };
} | null;

interface RowData {
  id: number;
  alumni_id: number;
  status: SaveStatus;
  reason: SaveReason | null;
  note: string | null;
  created_at: Date | string;
  updated_at: Date | string;
  alum_first_name: string | null;
  alum_last_name: string | null;
  alum_uwc_college: string | null;
  alum_grad_year: number | null;
  alum_current_title: string | null;
  alum_current_company: string | null;
  alum_current_company_linkedin: string | null;
  alum_current_company_website: string | null;
  alum_current_company_logo_url: string | null;
  alum_current_city: string | null;
  alum_photo_url: string | null;
  alum_linkedin_url: string | null;
  alum_origin: string | null;
}

const STATUS_COLORS: Record<SaveStatus, string> = {
  not_contacted: "bg-slate-100 text-slate-800 border-slate-200",
  invite_sent: "bg-amber-50 text-amber-800 border-amber-200",
  connected: "bg-emerald-50 text-emerald-800 border-emerald-200",
  replied: "bg-sky-50 text-sky-800 border-sky-200",
  met: "bg-violet-50 text-violet-800 border-violet-200",
  follow_up_later: "bg-orange-50 text-orange-800 border-orange-200",
};

interface Props {
  allSaves: RowData[];
  statusFilter: SaveStatus | undefined;
}

/**
 * Owns hidden-row state so the chip-bar counts and "N saved" header
 * stay in sync as users unsave rows via the star. Hidden rows are
 * removed from BOTH the counts and the visible list immediately;
 * when the SaveStar's undo restores a row, it's re-added.
 */
export default function SavedList({ allSaves, statusFilter }: Props) {
  // Set of alumni_ids currently hidden via optimistic unsave.
  const [hidden, setHidden] = useState<Set<number>>(new Set());
  // The pending undo entry — when set, the toast at the bottom shows.
  const [pending, setPending] = useState<PendingUndo>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setVisible = (alumniId: number, saved: boolean) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (saved) next.delete(alumniId);
      else next.add(alumniId);
      return next;
    });
  };

  /** Fire the actual DELETE for the previously-shown undo entry
   * BEFORE we overwrite the pending state. Otherwise rapid-fire
   * unsaves would silently drop earlier deletes on the floor. */
  const flushPending = (entry: NonNullable<PendingUndo>) => {
    void fetch(`/api/directory/save?alumni_id=${entry.alumniId}`, {
      method: "DELETE",
    }).catch(() => undefined);
  };

  const onUnsave = (
    alumniId: number,
    prev: { status: SaveStatus; reason: SaveReason | null; note: string | null },
  ) => {
    if (undoTimer.current) {
      clearTimeout(undoTimer.current);
      if (pending) flushPending(pending);
    }
    setPending({ alumniId, prev });
    undoTimer.current = setTimeout(() => {
      setPending((cur) => {
        if (cur && cur.alumniId === alumniId) {
          flushPending(cur);
          return null;
        }
        return cur;
      });
    }, 5000);
  };

  const onUndo = async () => {
    const entry = pending;
    if (!entry) return;
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setPending(null);
    setVisible(entry.alumniId, true);
    try {
      await fetch("/api/directory/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          alumni_id: entry.alumniId,
          status: entry.prev.status,
          reason: entry.prev.reason,
          note: entry.prev.note,
        }),
      });
    } catch {
      // best-effort — UI already restored the row optimistically
    }
  };

  const visibleSaves = allSaves.filter((s) => !hidden.has(s.alumni_id));

  const counts: Record<SaveStatus, number> = {
    not_contacted: 0,
    invite_sent: 0,
    connected: 0,
    replied: 0,
    met: 0,
    follow_up_later: 0,
  };
  for (const s of visibleSaves) counts[s.status] += 1;

  const filtered = statusFilter
    ? visibleSaves.filter((s) => s.status === statusFilter)
    : visibleSaves;

  return (
    <>
      <p className="text-sm text-[color:var(--muted)] mt-1 mb-5">
        {visibleSaves.length} saved · personal to your account
      </p>

      <div className="flex flex-wrap items-center gap-2 mb-5">
        <Link
          href="/directory/saved"
          className={`text-xs font-semibold px-2.5 py-1.5 rounded-full border ${
            !statusFilter
              ? "bg-navy text-white border-navy"
              : "border-[color:var(--rule)] text-[color:var(--muted)] hover:text-navy hover:border-navy"
          }`}
        >
          All ({visibleSaves.length})
        </Link>
        {SAVE_STATUSES.map((s) => (
          <Link
            key={s}
            href={`/directory/saved?status=${s}`}
            className={`text-xs font-semibold px-2.5 py-1.5 rounded-full border ${
              statusFilter === s
                ? "bg-navy text-white border-navy"
                : `${STATUS_COLORS[s]} hover:opacity-90`
            }`}
          >
            {STATUS_LABELS[s]} ({counts[s]})
          </Link>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white border border-dashed border-[color:var(--rule)] rounded-[10px] p-10 text-center text-[color:var(--muted)] text-sm">
          {visibleSaves.length === 0
            ? "Nothing saved yet. Click ★ Save on any profile to start."
            : "No saves match that status."}
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((row) => (
            <SavedRow
              key={row.id}
              row={row}
              onSavedChange={(saved) => setVisible(row.alumni_id, saved)}
              onUnsave={(prev) => onUnsave(row.alumni_id, prev)}
            />
          ))}
        </ul>
      )}

      {pending && (
        <div
          role="status"
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-navy text-white px-4 py-2.5 rounded-full shadow-lg text-sm flex items-center gap-3"
        >
          Removed from your shortlist.
          <button
            type="button"
            onClick={() => void onUndo()}
            className="font-bold uppercase tracking-[.18em] text-xs hover:underline"
          >
            Undo
          </button>
        </div>
      )}
    </>
  );
}
