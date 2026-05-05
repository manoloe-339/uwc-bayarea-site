"use client";

import { useState, useTransition } from "react";
import { snoozeSignalAction } from "@/app/admin/dashboard-actions";

const PRESETS = [3, 7, 14, 30] as const;

export function SnoozePopover({ signalId }: { signalId: string }) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(7);
  const [pending, startTransition] = useTransition();

  function snooze(days: number) {
    startTransition(async () => {
      await snoozeSignalAction(signalId, days);
      setOpen(false);
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
        Snooze ▾
      </button>
      {open && (
        <>
          <button
            type="button"
            aria-label="Close snooze popover"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-10 cursor-default"
          />
          <div
            role="dialog"
            className="absolute right-0 bottom-[calc(100%+6px)] z-20 w-[240px] bg-white border border-[color:var(--rule)] rounded-lg shadow-[0_10px_30px_-12px_rgba(11,37,69,0.18)] p-3"
          >
            <div className="text-[10.5px] tracking-[.22em] uppercase font-bold text-navy mb-2">
              Snooze for
            </div>
            <div className="grid grid-cols-4 gap-1 mb-2">
              {PRESETS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => snooze(d)}
                  disabled={pending}
                  className="border border-[color:var(--rule)] rounded text-xs font-semibold py-1.5 hover:border-navy hover:text-navy disabled:opacity-50"
                >
                  {d}d
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={1}
                max={365}
                value={custom}
                onChange={(e) => setCustom(Math.max(1, Number(e.target.value) || 1))}
                className="w-14 px-1.5 py-1 text-xs border border-[color:var(--rule)] rounded text-[color:var(--navy-ink)]"
              />
              <span className="text-xs text-[color:var(--muted)]">days</span>
              <button
                type="button"
                onClick={() => snooze(custom)}
                disabled={pending}
                className="ml-auto bg-navy text-white border-none rounded px-2.5 py-1 text-xs font-semibold disabled:opacity-50"
              >
                Snooze
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
