"use client";

import { useRef, useState } from "react";
import {
  MAX_NOTE_CHARS,
  REASON_LABELS,
  SAVE_REASONS,
  type SaveReason,
  type SaveStatus,
} from "@/lib/directory-saves-shared";

interface Props {
  alumniId: number;
  initialReason: SaveReason | null;
  initialNote: string | null;
  /** Existing status gets re-sent on upsert so changing reason / note
   * doesn't reset it. */
  status: SaveStatus;
}

/** Inline reason + note editor for the saved page. Reason persists on
 * change, note persists on blur. Subtle "Saved ✓" flash after each
 * write. */
export default function SavedReasonEditor({
  alumniId,
  initialReason,
  initialNote,
  status,
}: Props) {
  const [reason, setReason] = useState<SaveReason | "">(initialReason ?? "");
  const [note, setNote] = useState<string>(initialNote ?? "");
  const [flash, setFlash] = useState(false);
  const [busy, setBusy] = useState(false);
  const lastNote = useRef<string>(initialNote ?? "");

  const upsert = async (patch: {
    reason?: SaveReason | "";
    note?: string;
  }) => {
    setBusy(true);
    try {
      const res = await fetch("/api/directory/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          alumni_id: alumniId,
          status,
          reason:
            patch.reason !== undefined
              ? patch.reason || null
              : reason || null,
          note:
            patch.note !== undefined
              ? patch.note.trim() || null
              : note.trim() || null,
        }),
      });
      if (res.ok) {
        setFlash(true);
        setTimeout(() => setFlash(false), 1200);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 grid grid-cols-1 sm:grid-cols-[180px_1fr_auto] gap-2 items-start">
      <label className="block">
        <span className="block text-[10px] tracking-[.18em] uppercase font-bold text-[color:var(--muted)] mb-0.5">
          Reason
        </span>
        <select
          value={reason}
          disabled={busy}
          onChange={(e) => {
            const next = e.target.value as SaveReason | "";
            setReason(next);
            void upsert({ reason: next });
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
      <label className="block">
        <span className="block text-[10px] tracking-[.18em] uppercase font-bold text-[color:var(--muted)] mb-0.5">
          Note <span className="font-normal text-[color:var(--muted)]">(max {MAX_NOTE_CHARS})</span>
        </span>
        <textarea
          value={note}
          maxLength={MAX_NOTE_CHARS}
          rows={2}
          disabled={busy}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => {
            if (note !== lastNote.current) {
              lastNote.current = note;
              void upsert({ note });
            }
          }}
          placeholder="Why are you saving them?"
          className="w-full border border-[color:var(--rule)] rounded px-2 py-1.5 text-xs bg-white resize-y"
        />
      </label>
      <span
        className={`self-end text-[10px] tracking-[.18em] uppercase font-bold ${
          flash ? "text-emerald-700" : "text-transparent"
        } transition-colors`}
      >
        Saved ✓
      </span>
    </div>
  );
}
