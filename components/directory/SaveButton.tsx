"use client";

import { useEffect, useRef, useState } from "react";
import {
  MAX_NOTE_CHARS,
  REASON_LABELS,
  SAVE_REASONS,
  SAVE_STATUSES,
  STATUS_LABELS,
  type SaveReason,
  type SaveStatus,
} from "@/lib/directory-saves";

type Initial = {
  status: SaveStatus;
  reason: SaveReason | null;
  note: string | null;
} | null;

interface Props {
  alumniId: number;
  initial: Initial;
  /** When false, the save UI renders disabled with a hint to sign in. */
  canSave: boolean;
  /** Visual variant: 'pill' for the card-grid, 'banner' for the profile page. */
  variant?: "pill" | "banner";
}

export function SaveButton({ alumniId, initial, canSave, variant = "pill" }: Props) {
  const [saved, setSaved] = useState<Initial>(initial);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState(false);
  const [undoFor, setUndoFor] = useState<Initial>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Flash the "Saved ✓" indicator briefly after any successful write.
  const flashSaved = () => {
    setFlash(true);
    setTimeout(() => setFlash(false), 1200);
  };

  const upsert = async (patch: Partial<NonNullable<Initial>>) => {
    if (!canSave) return;
    const next = {
      status: patch.status ?? saved?.status ?? "not_contacted",
      reason: patch.reason !== undefined ? patch.reason : saved?.reason ?? null,
      note: patch.note !== undefined ? patch.note : saved?.note ?? null,
    };
    setBusy(true);
    try {
      const res = await fetch("/api/directory/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          alumni_id: alumniId,
          status: next.status,
          reason: next.reason,
          note: next.note,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSaved(next as NonNullable<Initial>);
      flashSaved();
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!canSave || !saved) return;
    const prev = saved;
    setSaved(null);
    setOpen(false);
    // Stash for undo and schedule the real delete after 5s.
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
      }
    } finally {
      setUndoFor(null);
      setBusy(false);
    }
  };

  if (!canSave) {
    return (
      <span className="text-xs text-[color:var(--muted)] italic">
        Sign in with a personal account to save.
      </span>
    );
  }

  const toggleSavedClick = async () => {
    if (saved) {
      setOpen((o) => !o);
    } else {
      await upsert({ status: "not_contacted" });
      setOpen(true);
    }
  };

  const pillButton = (
    <button
      type="button"
      onClick={toggleSavedClick}
      disabled={busy}
      className={`text-xs font-semibold rounded px-2.5 py-1 border ${
        saved
          ? "bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100"
          : "border-[color:var(--rule)] text-[color:var(--muted)] hover:text-navy hover:border-navy"
      } disabled:opacity-50`}
    >
      {saved ? "★ Saved" : "★ Save"}
    </button>
  );

  return (
    <div className={variant === "banner" ? "" : "flex flex-col items-start gap-2"}>
      {variant === "banner" ? null : pillButton}
      {variant === "banner" && (
        <div className="flex items-center gap-2 mb-2">
          {pillButton}
          {flash && (
            <span className="text-xs text-emerald-700 font-semibold">Saved ✓</span>
          )}
        </div>
      )}

      {open && saved && (
        <div className="w-full bg-white border border-[color:var(--rule)] rounded p-3 mt-1 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="block text-[10px] tracking-[.18em] uppercase font-bold text-[color:var(--muted)] mb-0.5">
                Status
              </span>
              <select
                value={saved.status}
                onChange={(e) => {
                  void upsert({ status: e.target.value as SaveStatus });
                }}
                className="w-full border border-[color:var(--rule)] rounded px-2 py-1.5 text-xs bg-white"
              >
                {SAVE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="block text-[10px] tracking-[.18em] uppercase font-bold text-[color:var(--muted)] mb-0.5">
                Reason
              </span>
              <select
                value={saved.reason ?? ""}
                onChange={(e) => {
                  void upsert({
                    reason: (e.target.value || null) as SaveReason | null,
                  });
                }}
                className="w-full border border-[color:var(--rule)] rounded px-2 py-1.5 text-xs bg-white"
              >
                <option value="">—</option>
                {SAVE_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {REASON_LABELS[r]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="block">
            <span className="block text-[10px] tracking-[.18em] uppercase font-bold text-[color:var(--muted)] mb-0.5">
              Note (max {MAX_NOTE_CHARS} chars)
            </span>
            <textarea
              defaultValue={saved.note ?? ""}
              maxLength={MAX_NOTE_CHARS}
              rows={2}
              onBlur={(e) => {
                const v = e.target.value;
                if (v !== (saved.note ?? "")) {
                  void upsert({ note: v });
                }
              }}
              placeholder="Why are you saving them?"
              className="w-full border border-[color:var(--rule)] rounded px-2 py-1.5 text-xs bg-white"
            />
          </label>
          <div className="flex items-center justify-between">
            {flash && variant !== "banner" && (
              <span className="text-[10px] text-emerald-700 font-semibold">
                Saved ✓
              </span>
            )}
            <button
              type="button"
              onClick={remove}
              className="text-[10px] tracking-[.18em] uppercase font-bold text-rose-700 hover:underline ml-auto"
            >
              Remove from list
            </button>
          </div>
        </div>
      )}

      {undoFor && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-navy text-white px-4 py-2.5 rounded-full shadow-lg text-sm flex items-center gap-3">
          Removed from your list.
          <button
            type="button"
            onClick={undo}
            className="font-bold uppercase tracking-[.18em] text-xs hover:underline"
          >
            Undo
          </button>
        </div>
      )}
    </div>
  );
}
