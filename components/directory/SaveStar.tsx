"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  MAX_NOTE_CHARS,
  REASON_LABELS,
  SAVE_REASONS,
  type SaveReason,
  type SaveStatus,
} from "@/lib/directory-saves-shared";
import { Icon } from "./Icon";

type Initial = {
  status: SaveStatus;
  reasons: SaveReason[];
  note: string | null;
} | null;

interface Props {
  alumniId: number;
  alumName: string;
  initial: Initial;
  canSave: boolean;
  className?: string;
  size?: number;
  onSavedChange?: (saved: boolean) => void;
  onUnsave?: (prev: NonNullable<Initial>) => void;
  /** When true, render the gold gallery-card star (filled gold on
   * save, white outline when not saved) — matches the photo-overlay
   * treatment. When false, the legacy navy-ink star is used.
   * Defaults to true (the new gallery card is the common case). */
  gallery?: boolean;
  /** "star" → just the icon (default; gallery card overlay).
   *  "button" → outlined pill with gold star + "Save" / "Saved" label,
   *             used on the detail page action row. */
  variant?: "star" | "button";
}

const GOLD = "#E89A1C";

/**
 * Save-to-shortlist star. Click to save → opens a small modal where
 * the user can add reasons (multi-select pills) + a private note;
 * those autosave as they're edited. Click again on a saved card →
 * 5-second undo window before the DELETE fires.
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
  gallery = true,
  variant = "star",
}: Props) {
  const [saved, setSaved] = useState<Initial>(initial);
  const [open, setOpen] = useState(false);
  // Portals must mount only after hydration, otherwise SSR pulls in
  // window/document and crashes.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [busy, setBusy] = useState(false);
  const [reasons, setReasons] = useState<SaveReason[]>(initial?.reasons ?? []);
  const [note, setNote] = useState<string>(initial?.note ?? "");
  const [flash, setFlash] = useState(false);
  const [savedToast, setSavedToast] = useState(false);
  const [wasFreshSave, setWasFreshSave] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [undoFor, setUndoFor] = useState<Initial>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastNote = useRef<string>(initial?.note ?? "");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (open) {
      setReasons(saved?.reasons ?? []);
      setNote(saved?.note ?? "");
      setError(null);
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  }, [open, saved]);

  if (!canSave) return null;

  const autosave = async (patch?: {
    reasons?: SaveReason[];
    note?: string;
  }) => {
    const r = patch?.reasons !== undefined ? patch.reasons : reasons;
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
          status: saved?.status ?? "follow_up_later",
          reasons: r,
          note: (n ?? "").trim() || null,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? `Save failed (${res.status})`);
        return;
      }
      setSaved({
        status: saved?.status ?? "follow_up_later",
        reasons: r,
        note: (n ?? "").trim() || null,
      });
      if (!wasSaved) {
        onSavedChange?.(true);
      }
      setFlash(true);
      setTimeout(() => setFlash(false), 1200);
    } finally {
      setBusy(false);
    }
  };

  const handleStarClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!saved) {
      setWasFreshSave(true);
      void autosave();
      setOpen(true);
      return;
    }
    const prev = saved;
    setSaved(null);
    onSavedChange?.(false);
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
      // Intentionally no router.refresh() — that would reshuffle the
      // RANDOM()-ordered card grid on /directory. The layout's
      // saved-count badge picks up the new value on the next
      // navigation.
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
          reasons: undoFor.reasons,
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
  // Gallery star: gold filled when on; white outline when off (so it
  // reads over the photo). Legacy star (used in a few spots): navy.
  const starColor = gallery
    ? isSaved
      ? GOLD
      : "#fff"
    : isSaved
      ? GOLD
      : "var(--muted)";

  const toggleReason = (r: SaveReason) => {
    const next = reasons.includes(r)
      ? reasons.filter((x) => x !== r)
      : [...reasons, r];
    setReasons(next);
    void autosave({ reasons: next });
  };

  return (
    <>
      {variant === "button" ? (
        <button
          type="button"
          onClick={handleStarClick}
          aria-pressed={isSaved}
          title={isSaved ? "Saved — click to remove" : "Save to shortlist"}
          className={`inline-flex items-center gap-[7px] rounded-[9px] border border-[color:var(--rule)] bg-white px-[15px] py-[10px] text-[13.5px] font-semibold text-[color:var(--navy-ink)] hover:border-[color:rgba(11,37,69,.42)] ${className}`}
        >
          <span style={{ color: GOLD, display: "inline-flex" }}>
            <Icon name="star" size={15} filled={isSaved} strokeWidth={1.8} />
          </span>
          {isSaved ? "Saved" : "Save"}
        </button>
      ) : (
        <button
          type="button"
          onClick={handleStarClick}
          aria-label={isSaved ? "Remove from shortlist" : "Add to shortlist"}
          aria-pressed={isSaved}
          title={isSaved ? "Saved — click to remove" : "Save to shortlist"}
          className={`inline-flex items-center justify-center rounded transition-transform hover:scale-[1.12] ${className}`}
          style={{
            width: size + 8,
            height: size + 8,
            color: starColor,
          }}
        >
          <Icon name="star" size={size} strokeWidth={1.8} filled={isSaved} />
        </button>
      )}

      {mounted && savedToast &&
        createPortal(
          <div
            className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] bg-navy text-white px-4 py-2 rounded-full shadow-lg text-sm whitespace-nowrap flex items-center gap-2"
            role="status"
          >
            <span aria-hidden>⭐</span>
            Saved to your shortlist
          </div>,
          document.body,
        )}

      {mounted && undoFor &&
        createPortal(
          <div
            className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] bg-navy text-white px-4 py-2 rounded-full shadow-lg text-sm whitespace-nowrap flex items-center gap-3"
            role="status"
          >
            Removed from your shortlist
            <button
              type="button"
              onClick={undo}
              disabled={busy}
              className="font-bold uppercase tracking-[.18em] text-xs hover:underline disabled:opacity-50"
            >
              Undo
            </button>
          </div>,
          document.body,
        )}

      {mounted && open &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Save to shortlist"
            className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) setOpen(false);
            }}
          >
          <div
            className="bg-white rounded-[14px] max-w-[480px] w-full p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
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

            <div className="space-y-4">
              <div>
                <div className="text-[10.5px] font-bold tracking-[.16em] uppercase text-[color:var(--muted-2)] mb-2">
                  Reason for saving{" "}
                  <span className="font-semibold">· pick any</span>
                </div>
                <div className="flex flex-wrap gap-[7px]">
                  {SAVE_REASONS.map((r) => {
                    const on = reasons.includes(r);
                    return (
                      <button
                        key={r}
                        type="button"
                        disabled={busy}
                        aria-pressed={on}
                        onClick={() => toggleReason(r)}
                        className={`rounded-full border px-3 py-[6px] text-[12.5px] font-semibold whitespace-nowrap transition ${
                          on
                            ? "bg-navy border-navy text-white"
                            : "bg-white border-[color:var(--rule)] text-[color:var(--navy-ink)] hover:border-[color:rgba(11,37,69,.42)]"
                        }`}
                      >
                        {REASON_LABELS[r]}
                      </button>
                    );
                  })}
                </div>
              </div>

              <label className="block">
                <span className="block text-[10.5px] font-bold tracking-[.16em] uppercase text-[color:var(--muted-2)] mb-2">
                  Private note
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
                  placeholder="What do you want to remember?"
                  className="w-full min-h-[72px] rounded-[10px] bg-white border border-[color:var(--rule)] px-3 py-[10px] text-[14px] text-[color:var(--navy-ink)] leading-[1.5] focus:outline-none focus:border-navy focus:[box-shadow:0_0_0_3px_rgba(2,101,168,.12)]"
                />
              </label>

              {error && (
                <div className="text-xs text-red-700" role="alert">
                  {error}
                </div>
              )}

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
          </div>,
          document.body,
        )}
    </>
  );
}
