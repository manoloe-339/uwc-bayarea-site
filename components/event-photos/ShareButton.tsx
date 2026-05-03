"use client";

import { useState } from "react";

interface Props {
  /** Title passed to the native share sheet (mobile) and used for
   * fallback desktop copy. Should already include the brand suffix. */
  title: string;
  /** Optional secondary text passed to the native share sheet. */
  text?: string;
}

/** Small Share affordance for the public event gallery page.
 * Uses navigator.share() on mobile (one tap → native share sheet
 * with WhatsApp, iMessage, LinkedIn, etc.) and falls back to
 * clipboard-copy with a brief confirmation on desktop. */
export function ShareButton({ title, text }: Props) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onClick = async () => {
    setError(null);
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (!url) return;

    // Prefer the native share sheet when available (mobile + some
    // desktop browsers like Safari). Falls back to clipboard.
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch (err) {
        // User cancelled — silent. Other errors fall through to copy.
        if (err instanceof Error && err.name === "AbortError") return;
      }
    }

    if (typeof navigator !== "undefined" && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2400);
        return;
      } catch {
        setError("Couldn't copy — paste from the address bar instead.");
        setTimeout(() => setError(null), 4000);
        return;
      }
    }
    setError("Sharing not available — copy from the address bar.");
    setTimeout(() => setError(null), 4000);
  };

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-1.5 text-[color:var(--muted)] hover:text-navy text-sm font-semibold underline-offset-2 hover:underline"
        aria-label="Share this gallery"
      >
        <ShareIcon className="w-4 h-4" />
        Share
      </button>
      {copied && (
        <span
          role="status"
          className="text-xs text-green-700 font-semibold"
        >
          ✓ Copied — paste anywhere
        </span>
      )}
      {error && (
        <span role="status" className="text-xs text-rose-700">
          {error}
        </span>
      )}
    </span>
  );
}

function ShareIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  );
}
