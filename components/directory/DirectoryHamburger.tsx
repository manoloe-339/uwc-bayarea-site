"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import LogoutButton from "./LogoutButton";
import { Icon, type IconName } from "./Icon";

interface Props {
  isUserAccount: boolean;
  hasSession: boolean;
  /** When true, the menu only renders the overflow items (Log out,
   * uwcbayarea.org). The primary nav (Search / Snapshot / Saved)
   * lives in the segmented MobileDirectoryNav, so showing them here
   * would just duplicate. */
  mobileOverflowOnly?: boolean;
}

/**
 * Collapsing menu for the directory header. Each row uses the same
 * styling so the menu reads as one coherent list. When
 * `mobileOverflowOnly` is set, only Log out + the home link are shown.
 */
export default function DirectoryHamburger({
  isUserAccount,
  hasSession,
  mobileOverflowOnly,
}: Props) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

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

  // Single source of truth for the menu-row look — applied to Links,
  // the FeedbackButton trigger, and the LogoutButton trigger so every
  // row looks identical.
  const ROW =
    "flex items-center gap-2 w-full text-left px-4 py-2 text-sm text-[color:var(--navy-ink)] hover:bg-[color:var(--ivory-2)] disabled:opacity-50";
  const RowIcon = ({ name }: { name: IconName }) => (
    <span className="text-[color:var(--muted)] inline-flex shrink-0">
      <Icon name={name} size={16} strokeWidth={2} />
    </span>
  );

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Menu"
        aria-expanded={open}
        className={
          mobileOverflowOnly
            ? "inline-flex items-center justify-center w-[42px] h-[42px] rounded-full text-white"
            : "inline-flex items-center justify-center w-9 h-9 -mr-2 rounded text-navy hover:bg-[color:var(--ivory-2)]"
        }
        style={
          mobileOverflowOnly
            ? {
                background: "rgba(255,255,255,.12)",
                border: "1px solid rgba(255,255,255,.22)",
              }
            : undefined
        }
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
        >
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
          className="absolute right-0 top-full mt-2 w-[240px] bg-white border border-[color:var(--rule)] rounded-[10px] shadow-lg py-1.5 z-50"
        >
          {!mobileOverflowOnly && (
            <>
              <Link href="/directory" onClick={() => setOpen(false)} className={ROW}>
                <RowIcon name="search" />
                Search
              </Link>
              <Link
                href="/directory/snapshot"
                onClick={() => setOpen(false)}
                className={ROW}
              >
                <RowIcon name="bar-chart" />
                Snapshot
              </Link>
              {isUserAccount && (
                <Link
                  href="/directory/saved"
                  onClick={() => setOpen(false)}
                  className={ROW}
                >
                  <span className="text-[#E89A1C] inline-flex shrink-0">
                    <Icon name="star" size={16} filled />
                  </span>
                  Saved
                </Link>
              )}
            </>
          )}
          {hasSession && (
            <LogoutButton
              className={ROW}
              label={
                <>
                  <RowIcon name="log-out" />
                  Log out
                </>
              }
            />
          )}
          {!mobileOverflowOnly && (
            <div className="border-t border-[color:var(--rule)] my-1.5" />
          )}
          <Link href="/" onClick={() => setOpen(false)} className={ROW}>
            <RowIcon name="home" />
            uwcbayarea.org
          </Link>
        </div>
      )}
    </div>
  );
}
