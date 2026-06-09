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
}: Props) {
  const [saved, setSaved] = useState<Initial>(initial);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState<SaveReason | "">(initial?.reason ?? "");
  const [note, setNote] = useState<string>(initial?.note ?? "");
  const [error, setError] = useState<string | null>(null);
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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/directory/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          alumni_id: alumniId,
          // Preserve existing status on edits; default to not_contacted
          // for first-time saves.
          status: saved?.status ?? "not_contacted",
          reason: reason || null,
          note: note.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? `Save failed (${res.status})`);
        return;
      }
      setSaved({
        status: saved?.status ?? "not_contacted",
        reason: reason || null,
        note: note.trim() || null,
      });
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  const isSaved = !!saved;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={isSaved ? "Edit shortlist entry" : "Add to shortlist"}
        title={isSaved ? "On your shortlist — edit notes" : "Save to shortlist"}
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

            <form onSubmit={submit} className="space-y-3">
              <label className="block">
                <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-[color:var(--muted)] mb-1">
                  Reason (optional)
                </span>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value as SaveReason | "")}
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
                Change status or remove from your list on the Saved page.
              </p>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="text-xs text-[color:var(--muted)] hover:text-navy"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="bg-navy text-white px-5 py-2 rounded text-sm font-semibold hover:opacity-90 disabled:opacity-50"
                >
                  {busy ? "Saving…" : isSaved ? "Update" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
