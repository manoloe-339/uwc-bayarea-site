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
} from "@/lib/directory-saves-shared";
import { Icon, type IconName } from "./Icon";

interface Props {
  alumniId: number;
  initialStatus: SaveStatus;
  initialReasons: SaveReason[];
  initialNote: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

/** Map status → small leading icon next to the pill label, matching
 * the design's send / users / clock vocabulary. */
const STATUS_ICON: Record<SaveStatus, IconName> = {
  invite_sent: "send",
  connected: "users",
  follow_up_later: "clock",
};

/** Status pill label (no emoji — the leading Lucide icon carries the
 * meaning). Shared labels in directory-saves-shared still have the
 * emoji prefix for legacy callers; strip it here. */
const STATUS_TEXT: Record<SaveStatus, string> = {
  invite_sent: STATUS_LABELS.invite_sent.replace(/^\S+\s+/, ""),
  connected: STATUS_LABELS.connected.replace(/^\S+\s+/, ""),
  follow_up_later: STATUS_LABELS.follow_up_later.replace(/^\S+\s+/, ""),
};

function toDate(d: Date | string): Date {
  return typeof d === "string" ? new Date(d) : d;
}
function fmtAbsDate(d: Date | string): string {
  const date = toDate(d);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}
function fmtFullTimestamp(d: Date | string): string {
  return toDate(d).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Outreach footer rendered below the gallery card on /directory/saved.
 * Three blocks — Status (single-select pills), Reasons (multi-select
 * pills), Private note (textarea). Status + reasons persist on click;
 * note persists on blur. Stops click propagation so taps don't
 * activate the card's stretched-link to the detail page.
 */
export default function SavedOutreachFooter({
  alumniId,
  initialStatus,
  initialReasons,
  initialNote,
  createdAt,
  updatedAt,
}: Props) {
  const [status, setStatus] = useState<SaveStatus>(initialStatus);
  const [reasons, setReasons] = useState<SaveReason[]>(initialReasons);
  const [note, setNote] = useState<string>(initialNote ?? "");
  const [updated, setUpdated] = useState<Date | string>(updatedAt);
  const lastNote = useRef<string>(initialNote ?? "");
  const [busy, setBusy] = useState(false);

  const persist = async (
    next: { status?: SaveStatus; reasons?: SaveReason[]; note?: string },
  ) => {
    setBusy(true);
    try {
      const res = await fetch("/api/directory/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          alumni_id: alumniId,
          status: next.status ?? status,
          reasons: next.reasons ?? reasons,
          note:
            next.note !== undefined
              ? next.note.trim() || null
              : note.trim() || null,
        }),
      });
      if (res.ok) setUpdated(new Date());
    } finally {
      setBusy(false);
    }
  };

  // Keep local state in sync if the props change underneath us
  // (e.g. when SavedList unmounts/remounts on undo).
  useEffect(() => {
    lastNote.current = initialNote ?? "";
  }, [initialNote]);

  const toggleReason = (r: SaveReason) => {
    const next = reasons.includes(r)
      ? reasons.filter((x) => x !== r)
      : [...reasons, r];
    setReasons(next);
    void persist({ reasons: next });
  };

  const setStatusAndPersist = (s: SaveStatus) => {
    if (s === status) return;
    setStatus(s);
    void persist({ status: s });
  };

  const stop = (e: React.MouseEvent | React.FocusEvent | React.KeyboardEvent) =>
    e.stopPropagation();

  const createdEqualsUpdated =
    Math.abs(toDate(updated).getTime() - toDate(createdAt).getTime()) < 60_000;

  return (
    <div
      onClick={stop}
      className="bg-[#fbfaf6] border-t border-[color:var(--rule)] px-5 py-[18px] flex flex-col gap-4"
    >
      <div>
        <div className="text-[10.5px] font-bold tracking-[.16em] uppercase text-[color:var(--muted-2)] mb-[9px]">
          Status
        </div>
        <div className="flex flex-wrap gap-[7px]">
          {SAVE_STATUSES.map((s) => {
            const on = s === status;
            return (
              <button
                key={s}
                type="button"
                disabled={busy}
                aria-pressed={on}
                onClick={() => setStatusAndPersist(s)}
                className={`rpill inline-flex items-center gap-[7px] rounded-full border px-3 py-[7px] text-[12.5px] font-semibold whitespace-nowrap transition ${
                  on
                    ? "bg-navy border-navy text-white"
                    : "bg-white border-[color:var(--rule)] text-[color:var(--navy-ink)] hover:border-[color:rgba(11,37,69,.42)]"
                }`}
              >
                <Icon name={STATUS_ICON[s]} size={14} strokeWidth={2} />
                {STATUS_TEXT[s]}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div className="text-[10.5px] font-bold tracking-[.16em] uppercase text-[color:var(--muted-2)] mb-[9px]">
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
                className={`rpill inline-flex items-center gap-1 rounded-full border px-3 py-[6px] text-[12.5px] font-semibold whitespace-nowrap transition ${
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

      <div>
        <div className="text-[10.5px] font-bold tracking-[.16em] uppercase text-[color:var(--muted-2)] mb-[9px]">
          Private note
        </div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onClick={stop}
          onFocus={stop}
          onBlur={() => {
            if (note !== lastNote.current) {
              lastNote.current = note;
              void persist({ note });
            }
          }}
          maxLength={MAX_NOTE_CHARS}
          placeholder="What do you want to remember?"
          className="w-full min-h-[58px] resize-y rounded-[10px] bg-white border border-[color:var(--rule)] px-3 py-[10px] text-[14px] text-[color:var(--navy-ink)] leading-[1.5] focus:outline-none focus:border-navy focus:[box-shadow:0_0_0_3px_rgba(2,101,168,.12)]"
        />
      </div>

      <div
        className="text-right text-[12px] text-[color:var(--muted-2)]"
        title={`Saved ${fmtFullTimestamp(createdAt)}\nUpdated ${fmtFullTimestamp(updated)}`}
      >
        Saved {fmtAbsDate(createdAt)}
        {!createdEqualsUpdated && <> · Updated {fmtAbsDate(updated)}</>}
      </div>
    </div>
  );
}
