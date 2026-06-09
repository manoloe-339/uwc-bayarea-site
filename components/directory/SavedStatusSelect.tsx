"use client";

import { useState } from "react";
import {
  SAVE_STATUSES,
  STATUS_LABELS,
  type SaveReason,
  type SaveStatus,
} from "@/lib/directory-saves-shared";

interface Props {
  alumniId: number;
  initialStatus: SaveStatus;
  /** Existing reason / note get sent with the upsert so changing
   * status doesn't clobber them. */
  reason: SaveReason | null;
  note: string | null;
}

const STATUS_PILL: Record<SaveStatus, string> = {
  not_contacted: "bg-slate-100 text-slate-800 border-slate-200",
  invite_sent: "bg-amber-50 text-amber-800 border-amber-200",
  connected: "bg-emerald-50 text-emerald-800 border-emerald-200",
  replied: "bg-sky-50 text-sky-800 border-sky-200",
  met: "bg-violet-50 text-violet-800 border-violet-200",
  follow_up_later: "bg-orange-50 text-orange-800 border-orange-200",
};

/** Inline status dropdown for the Saved page rows. Persists on change
 * — no separate Save button. Sends the existing reason/note along
 * with the upsert so they aren't dropped. */
export default function SavedStatusSelect({
  alumniId,
  initialStatus,
  reason,
  note,
}: Props) {
  const [status, setStatus] = useState<SaveStatus>(initialStatus);
  const [busy, setBusy] = useState(false);

  const change = async (next: SaveStatus) => {
    setBusy(true);
    try {
      const res = await fetch("/api/directory/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          alumni_id: alumniId,
          status: next,
          reason,
          note,
        }),
      });
      if (res.ok) setStatus(next);
    } finally {
      setBusy(false);
    }
  };

  return (
    <select
      value={status}
      disabled={busy}
      onChange={(e) => void change(e.target.value as SaveStatus)}
      className={`text-[10px] tracking-[.18em] uppercase font-bold px-2 py-0.5 rounded-full border ${STATUS_PILL[status]} cursor-pointer disabled:opacity-50`}
    >
      {SAVE_STATUSES.map((s) => (
        <option key={s} value={s}>
          {STATUS_LABELS[s]}
        </option>
      ))}
    </select>
  );
}
