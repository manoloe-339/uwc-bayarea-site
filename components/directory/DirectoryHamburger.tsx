"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { FeedbackButton } from "./FeedbackButton";
import LogoutButton from "./LogoutButton";

interface Props {
  /** True when the visitor is a per-user account (vs shared-password). */
  isUserAccount: boolean;
  /** True when any directory session is active (per-user or shared). */
  hasSession: boolean;
}

/**
 * Mobile-only collapsing menu for the directory header. Holds the
 * same Snapshot / Saved / Feedback / Log out / ← uwcbayarea.org
 * links that show inline on desktop.
 */
export default function DirectoryHamburger({
  isUserAccount,
  hasSession,
}: Props) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  // Close on click-outside or Escape.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Menu"
        aria-expanded={open}
        className="inline-flex items-center justify-center w-9 h-9 -mr-2 rounded text-navy hover:bg-[color:var(--ivory-2)]"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          {open ? (
            <>
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="18" y1="6" x2="6" y2="18" />
            </>
          ) : (
            <>
              <line x1="4" y1="7" x2="20" y2="7" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="17" x2="20" y2="17" />
            </>
          )}
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 w-[220px] bg-white border border-[color:var(--rule)] rounded-[10px] shadow-lg py-2 z-50"
        >
          <Link
            href="/directory"
            onClick={() => setOpen(false)}
            className="block px-4 py-2 text-sm text-[color:var(--navy-ink)] hover:bg-[color:var(--ivory-2)]"
          >
            Directory
          </Link>
          <Link
            href="/directory/snapshot"
            onClick={() => setOpen(false)}
            className="block px-4 py-2 text-sm text-[color:var(--navy-ink)] hover:bg-[color:var(--ivory-2)]"
          >
            Snapshot
          </Link>
          {isUserAccount && (
            <Link
              href="/directory/saved"
              onClick={() => setOpen(false)}
              className="block px-4 py-2 text-sm text-[color:var(--navy-ink)] hover:bg-[color:var(--ivory-2)]"
            >
              Saved
            </Link>
          )}
          <div className="px-4 py-2">
            <FeedbackButton />
          </div>
          {hasSession && (
            <div className="px-4 py-2">
              <LogoutButton />
            </div>
          )}
          <div className="px-4 py-2 border-t border-[color:var(--rule)] mt-1">
            <Link
              href="/"
              onClick={() => setOpen(false)}
              className="text-[12px] tracking-[.22em] uppercase font-bold text-[color:var(--muted)] hover:text-navy"
            >
              ← uwcbayarea.org
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
