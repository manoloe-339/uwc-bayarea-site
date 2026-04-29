"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type NavKey = "home" | "events" | "photos" | "signup" | "contact";

const CONTACT_MAILTO = "mailto:manolo@uwcbayarea.org?subject=UWC%20Bay%20Area%20help";

// Sign Up is promoted to a standalone CTA on mobile; the rest live in the
// hamburger drawer. Desktop renders every link inline, as today.
const secondaryLinks: { key: NavKey; label: string; href: string }[] = [
  { key: "home", label: "Home", href: "/" },
  { key: "events", label: "Events", href: "/" },
  { key: "contact", label: "Contact", href: CONTACT_MAILTO },
];

export default function SiteHeader({ active }: { active?: NavKey }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  // Close on Escape + tap-outside.
  useEffect(() => {
    if (!menuOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMenuOpen(false);
        buttonRef.current?.focus();
      }
    }
    function onClick(e: MouseEvent) {
      if (
        drawerRef.current &&
        !drawerRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [menuOpen]);

  return (
    <nav
      className="sticky top-0 z-50 bg-navy text-white border-b border-white/10 relative
        after:content-[''] after:absolute after:left-0 after:right-0 after:-bottom-px after:h-0.5
        after:bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,.35)_20%,rgba(255,255,255,.35)_80%,transparent_100%)]"
    >
      <div className="max-w-[1200px] mx-auto flex items-center gap-3 px-3 sm:px-7 py-[14px] sm:py-[18px]">
        <Link
          href="/"
          className="flex items-center text-white no-underline shrink-0"
          aria-label="UWC Bay Area home"
        >
          <img
            src="/uwc-bay-area-logo.png"
            alt="UWC Bay Area · Alumni & Friends"
            className="h-[46px] sm:h-[52px] w-auto block rounded-sm"
          />
        </Link>

        {/* Push everything else to the right */}
        <div className="flex-1" />

        {/* ── Desktop nav (inline) ─────────────────────────────────────── */}
        <div className="hidden md:flex items-center gap-1">
          <NavLink href="/" active={active === "home"}>Home</NavLink>
          <NavLink href="/" active={active === "events"}>Events</NavLink>
          <NavLink href="/signup" active={active === "signup"}>Sign up</NavLink>
          <NavLink href={CONTACT_MAILTO} active={active === "contact"}>Contact</NavLink>
        </div>

        {/* ── Mobile: prioritized Sign Up CTA + hamburger ──────────────── */}
        <Link
          href="/signup"
          className="md:hidden inline-flex items-center justify-center bg-white text-navy font-semibold text-[12px] tracking-[.14em] uppercase px-3 py-[11px] rounded-full min-h-[44px] whitespace-nowrap"
          aria-label="Sign up"
        >
          Sign up
        </Link>

        <button
          ref={buttonRef}
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          aria-controls="site-mobile-menu"
          className="md:hidden inline-flex items-center justify-center w-11 h-11 rounded-md text-white hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/50"
        >
          {menuOpen ? <XIcon /> : <BurgerIcon />}
        </button>
      </div>

      {/* ── Mobile drawer ─────────────────────────────────────────────── */}
      <div
        id="site-mobile-menu"
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Main menu"
        className={`md:hidden absolute right-3 top-[calc(100%+6px)] w-56 max-w-[80vw] rounded-xl bg-navy border border-white/15 shadow-xl overflow-hidden transform transition origin-top-right ${
          menuOpen ? "opacity-100 scale-100 pointer-events-auto" : "opacity-0 scale-95 pointer-events-none"
        }`}
      >
        <ul className="flex flex-col py-2">
          {secondaryLinks.map((l) => (
            <li key={l.key}>
              <DrawerLink
                href={l.href}
                active={active === l.key}
                onNavigate={() => setMenuOpen(false)}
              >
                {l.label}
              </DrawerLink>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}

function NavLink({ href, active, children }: { href: string; active?: boolean; children: React.ReactNode }) {
  const base =
    "no-underline text-[12px] sm:text-[13px] tracking-[.08em] uppercase font-semibold " +
    "px-2.5 sm:px-3.5 py-2 sm:py-2.5 rounded-md transition-colors transition-[background] duration-150";
  const state = active
    ? "text-white bg-white/10 relative after:content-[''] after:block after:h-0.5 after:bg-white after:mt-1.5 after:rounded-sm"
    : "text-white/80 hover:text-white hover:bg-white/10";
  const className = `${base} ${state}`;
  if (href.startsWith("mailto:")) {
    return (
      <a href={href} className={className}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

function DrawerLink({
  href, active, onNavigate, children,
}: {
  href: string;
  active?: boolean;
  onNavigate: () => void;
  children: React.ReactNode;
}) {
  const base =
    "block w-full no-underline text-[13px] tracking-[.12em] uppercase font-semibold px-4 py-3 min-h-[44px] flex items-center";
  const state = active
    ? "text-white bg-white/10"
    : "text-white/85 hover:text-white hover:bg-white/10";
  const className = `${base} ${state}`;
  if (href.startsWith("mailto:")) {
    return (
      <a href={href} className={className} onClick={onNavigate}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className} onClick={onNavigate}>
      {children}
    </Link>
  );
}

function BurgerIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12" />
      <path d="M18 6l-12 12" />
    </svg>
  );
}
