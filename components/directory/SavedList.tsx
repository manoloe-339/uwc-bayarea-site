"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
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

interface Props {
  allSaves: RowData[];
}

/**
 * Renders the saved shortlist grouped into sections by status. No
 * filter chip bar — every non-empty status group is visible at once,
 * so users scan the whole list in priority order without clicking.
 * Owns hidden-row state (optimistic unsave) and the centralized undo
 * toast.
 */
export default function SavedList({ allSaves }: Props) {
  const router = useRouter();
  const [hidden, setHidden] = useState<Set<number>>(new Set());
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

  const flushPending = (entry: NonNullable<PendingUndo>) => {
    void fetch(`/api/directory/save?alumni_id=${entry.alumniId}`, {
      method: "DELETE",
    })
      .then(() => router.refresh())
      .catch(() => undefined);
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
      router.refresh();
    } catch {
      // best-effort
    }
  };

  const visibleSaves = allSaves.filter((s) => !hidden.has(s.alumni_id));

  // Group by status. Order: declared SAVE_STATUSES order.
  const groups: Record<SaveStatus, RowData[]> = {
    invite_sent: [],
    connected: [],
    follow_up_later: [],
  };
  for (const r of visibleSaves) groups[r.status].push(r);

  if (visibleSaves.length === 0) {
    return (
      <>
        <p className="text-sm text-white/75 mt-2 mb-5">
          0 saved · personal to your account
        </p>
        <div className="fp-panel p-10 text-center text-white/70 text-sm">
          Nothing saved yet. Click ★ Save on any profile to start.
        </div>
      </>
    );
  }

  return (
    <>
      <p className="text-sm text-white/75 mt-2 mb-6">
        {visibleSaves.length} saved · personal to your account
      </p>

      <div className="space-y-7">
        {SAVE_STATUSES.map((status) => {
          const rows = groups[status];
          if (rows.length === 0) return null;
          return (
            <section key={status}>
              <h2 className="text-[11px] tracking-[.22em] uppercase font-bold text-white mb-2 flex items-center gap-2">
                {STATUS_LABELS[status]}
                <span className="text-white/65 font-normal tracking-normal lowercase">
                  · {rows.length}
                </span>
              </h2>
              <ul className="space-y-3">
                {rows.map((row) => (
                  <SavedRow
                    key={row.id}
                    row={row}
                    onSavedChange={(saved) => setVisible(row.alumni_id, saved)}
                    onUnsave={(prev) => onUnsave(row.alumni_id, prev)}
                  />
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      {pending && (
        <div
          role="status"
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-navy text-white px-4 py-2 rounded-full shadow-lg text-sm whitespace-nowrap flex items-center gap-3"
        >
          Removed from your shortlist
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
