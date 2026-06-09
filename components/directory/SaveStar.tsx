"use client";

import { useEffect, useRef, useState } from "react";
import {
  MAX_NOTE_CHARS,
  REASON_LABELS,
  SAVE_REASONS,
  type SaveReason,
  type SaveStatus,
} from "@/lib/directory-saves-shared";

type Initial = {
  status: SaveStatus;
  reason: SaveReason | null;
  note: string | null;
} | null;

interface Props {
  alumniId: number;
  /** Alum's display name, used in the modal heading. */
  alumName: string;
  initial: Initial;
  /** When false, render nothing — shared-password sessions can't save. */
  canSave: boolean;
  /** Extra classes for positioning. The star itself is icon-only. */
  className?: string;
  /** Pixel size of the star glyph. Defaults to 22. */
  size?: number;
  /** Fired when the saved state flips. Lets a parent row hide itself
   * during the optimistic unsave window (and reshow on undo). */
  onSavedChange?: (saved: boolean) => void;
  /** Fired the instant the user toggles a save off. Parent receives
   * the previous state so it can offer undo. When set, the SaveStar
   * does NOT render its own toast or schedule its own DELETE — that
   * becomes the parent's responsibility. Useful when the row hosting
   * the SaveStar unmounts on unsave (e.g. /directory/saved), which
   * would otherwise take the internal toast with it. */
  onUnsave?: (prev: NonNullable<Initial>) => void;
}

/**
 * Icon-only "Save to shortlist" star. Renders in the top-right of a
 * card or wherever the parent positions it. Clicking opens a modal
 * with Reason + Note inputs only — status and removal live on
 * /directory/saved, not here. After the first successful save the
 * star fills in.
 */
export default function SaveStar({
  alumniId,
  alumName,
  initial,
  canSave,
  className = "",
  size = 22,
  onSavedChange,
  onUnsave,
}: Props) {
  const [saved, setSaved] = useState<Initial>(initial);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState<SaveReason | "">(initial?.reason ?? "");
  const [note, setNote] = useState<string>(initial?.note ?? "");
  const [flash, setFlash] = useState(false);
  const [savedToast, setSavedToast] = useState(false);
  /** True when the modal was opened on an empty star (i.e. this is a
   * fresh save, not an edit). Determines whether the "Saved to your
   * shortlist" toast fires when the user clicks Done. */
  const [wasFreshSave, setWasFreshSave] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [undoFor, setUndoFor] = useState<Initial>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastNote = useRef<string>(initial?.note ?? "");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (open) {
      // Reset form to whatever's saved (or empty for first-time) each
      // time the modal opens — so a previously-typed but cancelled
      // edit doesn't leak into the next session.
      setReason(saved?.reason ?? "");
      setNote(saved?.note ?? "");
      setError(null);
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  }, [open, saved]);

  if (!canSave) return null;

  /** Persist whatever's currently in the modal (status + reason +
   * note). Used by autosave on reason change and on note blur. */
  const autosave = async (patch?: { reason?: SaveReason | ""; note?: string }) => {
    const r = patch?.reason !== undefined ? patch.reason : reason;
    const n = patch?.note !== undefined ? patch.note : note;
    const wasSaved = !!saved;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/directory/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          alumni_id: alumniId,
          status: saved?.status ?? "not_contacted",
          reason: r || null,
          note: (n ?? "").trim() || null,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? `Save failed (${res.status})`);
        return;
      }
      setSaved({
        status: saved?.status ?? "not_contacted",
        reason: r || null,
        note: (n ?? "").trim() || null,
      });
      if (!wasSaved) {
        onSavedChange?.(true);
        // Don't fire the "Saved to your shortlist" toast yet — it
        // shows when the user clicks Done so it isn't covered by the
        // open modal. wasFreshSave was set in handleStarClick.
      }
      setFlash(true);
      setTimeout(() => setFlash(false), 1200);
    } finally {
      setBusy(false);
    }
  };

  /** Star click. If not saved → create the save immediately (with
   * whatever's in initial / "not_contacted") AND open the modal so
   * the user can optionally add reason + note (which then autosave).
   * If already saved → toggle off with a 5s undo window. */
  const handleStarClick = () => {
    if (!saved) {
      // Create the save right away so the star fills without waiting
      // for the modal to be submitted. Modal opens for optional
      // reason/note collection — those autosave as the user fills them.
      setWasFreshSave(true);
      void autosave();
      setOpen(true);
      return;
    }
    const prev = saved;
    setSaved(null);
    onSavedChange?.(false);
    // When parent provides onUnsave, defer the toast + DELETE timer
    // to them — the row hosting this SaveStar is about to unmount,
    // which would otherwise nuke our internal undo state.
    if (onUnsave) {
      onUnsave(prev);
      return;
    }
    setUndoFor(prev);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(async () => {
      setUndoFor(null);
      await fetch(`/api/directory/save?alumni_id=${alumniId}`, {
        method: "DELETE",
      }).catch(() => undefined);
    }, 5000);
  };

  const undo = async () => {
    if (!undoFor) return;
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setBusy(true);
    try {
      const res = await fetch("/api/directory/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          alumni_id: alumniId,
          status: undoFor.status,
          reason: undoFor.reason,
          note: undoFor.note,
        }),
      });
      if (res.ok) {
        setSaved(undoFor);
        onSavedChange?.(true);
      }
    } finally {
      setUndoFor(null);
      setBusy(false);
    }
  };

  const isSaved = !!saved;

  return (
    <>
      <button
        type="button"
        onClick={handleStarClick}
        aria-label={isSaved ? "Remove from shortlist" : "Add to shortlist"}
        aria-pressed={isSaved}
        title={isSaved ? "Saved — click to remove" : "Save to shortlist"}
        className={`inline-flex items-center justify-center rounded hover:bg-[color:var(--ivory-2)] transition-colors ${className}`}
        style={{
          width: size + 8,
          height: size + 8,
          color: isSaved ? "#D97706" : "var(--muted)",
        }}
      >
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill={isSaved ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M12 2.5l2.95 5.98 6.6.96-4.78 4.66 1.13 6.57L12 17.6l-5.9 3.07 1.13-6.57L2.45 9.44l6.6-.96L12 2.5z" />
        </svg>
      </button>

      {savedToast && (
        <div
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-navy text-white px-4 py-2.5 rounded-full shadow-lg text-sm flex items-center gap-2"
          role="status"
        >
          <span aria-hidden>⭐</span>
          Saved to your shortlist
        </div>
      )}

      {undoFor && (
        <div
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-navy text-white px-4 py-2.5 rounded-full shadow-lg text-sm flex items-center gap-3"
          role="status"
        >
          Removed from your shortlist.
          <button
            type="button"
            onClick={undo}
            disabled={busy}
            className="font-bold uppercase tracking-[.18em] text-xs hover:underline disabled:opacity-50"
          >
            Undo
          </button>
        </div>
      )}

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Save to shortlist"
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="bg-white rounded-[10px] max-w-[480px] w-full p-6 shadow-2xl">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="text-[11px] tracking-[.22em] uppercase font-bold text-navy">
                  {isSaved ? "★ On your shortlist" : "★ Save to shortlist"}
                </div>
                <h2 className="font-sans font-bold text-[20px] text-[color:var(--navy-ink)] mt-1">
                  {alumName}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="text-[color:var(--muted)] hover:text-navy text-2xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="space-y-3">
              <label className="block">
                <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-[color:var(--muted)] mb-1">
                  Reason (optional)
                </span>
                <select
                  value={reason}
                  disabled={busy}
                  onChange={(e) => {
                    const next = e.target.value as SaveReason | "";
                    setReason(next);
                    void autosave({ reason: next });
                  }}
                  className="w-full border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white"
                >
                  <option value="">—</option>
                  {SAVE_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {REASON_LABELS[r]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-[color:var(--muted)] mb-1">
                  Note (optional, max {MAX_NOTE_CHARS} chars)
                </span>
                <textarea
                  ref={textareaRef}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  onBlur={() => {
                    if (note !== lastNote.current) {
                      lastNote.current = note;
                      void autosave({ note });
                    }
                  }}
                  maxLength={MAX_NOTE_CHARS}
                  rows={3}
                  placeholder="Why are you saving them?"
                  className="w-full border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white"
                />
              </label>

              {error && (
                <div className="text-xs text-red-700" role="alert">
                  {error}
                </div>
              )}

              <p className="text-[11px] text-[color:var(--muted)] italic">
                Changes save automatically. Manage status or remove on the Saved page.
              </p>

              <div className="flex items-center justify-end gap-3 pt-1">
                <span
                  className={`text-[10px] tracking-[.18em] uppercase font-bold ${
                    flash ? "text-emerald-700" : "text-transparent"
                  } transition-colors`}
                >
                  Saved ✓
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    // Fire the toast AFTER the modal closes — so it
                    // isn't covered by the dialog overlay.
                    if (wasFreshSave) {
                      setSavedToast(true);
                      if (savedToastTimer.current)
                        clearTimeout(savedToastTimer.current);
                      savedToastTimer.current = setTimeout(
                        () => setSavedToast(false),
                        3500,
                      );
                    }
                    setWasFreshSave(false);
                  }}
                  className="bg-navy text-white px-5 py-2 rounded text-sm font-semibold hover:opacity-90"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
