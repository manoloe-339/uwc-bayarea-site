"use client";

import { useEffect, useState } from "react";
import DirectoryLoginForm from "./DirectoryLoginForm";

interface Props {
  next: string;
}

/** Default reload interval while the user is idly watching the
 * backdrops cycle. Aligns with one full rotation through Living
 * Wall → Mosaic → Constellation (3 × 10s = 30s). Each reload pulls
 * a fresh photo subset + new tile positions so a viewer sees a
 * different layout every cycle. */
const IDLE_RELOAD_MS = 30_000;

/**
 * Two-state sign-in surface:
 *
 *   Idle  — a small "Log in" button centered over the backdrop, plus
 *           an auto-reload timer that fires every IDLE_RELOAD_MS so
 *           the layout changes for a watching viewer.
 *   Form  — the user clicked Log in; reveals the full sign-in card
 *           (eyebrow + heading + email/password). The reload timer
 *           stops so we don't interrupt typing.
 */
export default function LoginGateCard({ next }: Props) {
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (showForm) return;
    const t = setTimeout(() => {
      window.location.reload();
    }, IDLE_RELOAD_MS);
    return () => clearTimeout(t);
  }, [showForm]);

  if (!showForm) {
    return (
      <button
        type="button"
        onClick={() => setShowForm(true)}
        aria-label="Open sign-in form"
        className="inline-flex items-center gap-2 rounded-full px-7 py-3 text-[14px] font-bold tracking-[.08em] uppercase text-[color:var(--navy-ink)] transition hover:brightness-105 active:scale-[.985]"
        style={{
          background: "rgba(255,255,255,.97)",
          border: "1px solid rgba(11,37,69,.08)",
          boxShadow:
            "0 2px 0 var(--ivory-3), 0 30px 60px -30px rgba(11,37,69,.6)",
        }}
      >
        <span
          aria-hidden
          className="inline-block w-3 h-0.5 bg-navy"
        />
        Log in
      </button>
    );
  }

  return (
    <div
      className="w-full max-w-[320px] rounded-[12px] p-5 sm:p-6"
      style={{
        background: "rgba(255,255,255,.97)",
        border: "1px solid rgba(11,37,69,.08)",
        boxShadow:
          "0 2px 0 var(--ivory-3), 0 30px 60px -30px rgba(11,37,69,.5)",
      }}
    >
      <div className="flex items-center gap-2 text-navy font-bold text-[10px] tracking-[.22em] uppercase">
        <span className="inline-block w-5 h-0.5 bg-navy" aria-hidden />
        Directory access
      </div>
      <h1
        className="text-[color:var(--navy-ink)] mt-2 font-extrabold leading-[1.04]"
        style={{
          fontFamily: "Inter, system-ui, sans-serif",
          fontSize: "clamp(22px, 5vw, 28px)",
          letterSpacing: "-.025em",
        }}
      >
        Sign in
      </h1>
      <div className="mt-3">
        <DirectoryLoginForm next={next} />
      </div>
    </div>
  );
}
