"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Item = { href: string; label: string };

const ITEMS: Item[] = [
  { href: "/admin/events", label: "Events" },
  { href: "/admin/email/campaigns", label: "Email" },
  { href: "/admin/email/preview", label: "Preview" },
  { href: "/admin/email/settings", label: "Settings" },
  { href: "/admin/import", label: "Import" },
  { href: "/admin/tools", label: "Tools" },
  { href: "/admin/unsubscribes", label: "Unsubscribes" },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/", label: "← Site" },
];

export default function MobileNavMenu() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label="Open menu"
        onClick={() => setOpen(true)}
        className="md:hidden ml-auto inline-flex items-center justify-center w-9 h-9 rounded border border-[color:var(--rule)] bg-white text-[color:var(--navy-ink)]"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
          <line x1="4" y1="7" x2="20" y2="7" />
          <line x1="4" y1="12" x2="20" y2="12" />
          <line x1="4" y1="17" x2="20" y2="17" />
        </svg>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/30"
          />
          <div className="absolute right-0 top-0 h-full w-[75%] max-w-[280px] bg-white shadow-xl flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[color:var(--rule)]">
              <span className="font-sans font-bold text-navy text-[15px] tracking-tight">Menu</span>
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setOpen(false)}
                className="w-8 h-8 inline-flex items-center justify-center text-[color:var(--muted)]"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
                  <line x1="6" y1="6" x2="18" y2="18" />
                  <line x1="18" y1="6" x2="6" y2="18" />
                </svg>
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto py-2">
              {ITEMS.map((it) => (
                <Link
                  key={it.href}
                  href={it.href}
                  onClick={() => setOpen(false)}
                  className="block px-5 py-3 text-[13px] tracking-[.12em] uppercase font-semibold text-[color:var(--navy-ink)] hover:bg-ivory-2"
                >
                  {it.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
