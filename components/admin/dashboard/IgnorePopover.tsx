"use client";

import { useState, useTransition } from "react";
import { ignoreSignalAction } from "@/app/admin/dashboard-actions";

/** Indefinite "hide this card" with a reason. The reason persists per
 * kind so when a similar card recurs (e.g. next month's Foodies
 * newsletter), the dashboard surfaces the prior rationale as muted
 * context. Distinct from Snooze, which is time-bounded and
 * reasonless. */
export function IgnorePopover({
  signalId,
  kind,
}: {
  signalId: string;
  kind: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      await ignoreSignalAction(signalId, kind, reason);
      setOpen(false);
      setReason("");
    });
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`text-xs font-medium text-[color:var(--muted)] hover:text-navy px-1.5 py-1.5 ${
          open ? "underline" : ""
        }`}
        aria-expanded={open}
      >
        Ignore ▾
      </button>
      {open && (
        <>
          <button
            type="button"
            aria-label="Close ignore popover"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-10 cursor-default"
          />
          <div
            role="dialog"
            className="absolute right-0 bottom-[calc(100%+6px)] z-20 w-[280px] bg-white border border-[color:var(--rule)] rounded-lg shadow-[0_10px_30px_-12px_rgba(11,37,69,0.18)] p-3"
          >
            <div className="text-[10.5px] tracking-[.22em] uppercase font-bold text-navy mb-1.5">
              Ignore — why?
            </div>
            <p className="text-[11px] text-[color:var(--muted)] mb-2 leading-snug">
              Hides this card. The reason shows up as context if a similar card
              comes back later.
            </p>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="e.g. handled in WhatsApp this month"
              className="w-full px-2 py-1.5 text-xs border border-[color:var(--rule)] rounded text-[color:var(--navy-ink)] resize-y mb-2"
            />
            <div className="flex items-center gap-2 justify-end">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setReason("");
                }}
                className="text-xs text-[color:var(--muted)] hover:text-navy px-1"
                disabled={pending}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={pending}
                className="bg-navy text-white border-none rounded px-2.5 py-1 text-xs font-semibold disabled:opacity-50"
              >
                {pending ? "Ignoring…" : "Ignore"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
