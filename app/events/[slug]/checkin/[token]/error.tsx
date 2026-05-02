"use client";

import { useEffect } from "react";

/**
 * Error boundary for the check-in page. Replaces Next.js's generic
 * "Application error: a client-side exception has occurred" with the
 * actual message + a Reload button + Sentry-style digest. Helps the
 * volunteer recover without closing the tab and helps us diagnose
 * failures from screenshots.
 */
export default function CheckinError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface the error in the browser console for debugging.
    console.error("[checkin] error boundary caught:", error);
  }, [error]);

  const reload = () => {
    if (typeof window !== "undefined") window.location.reload();
  };

  return (
    <div className="min-h-screen bg-ivory flex items-center justify-center p-5">
      <div className="bg-white border border-[color:var(--rule)] rounded-[12px] p-6 max-w-[420px] w-full text-center">
        <div className="text-[11px] tracking-[.22em] uppercase font-bold text-rose-700 mb-2">
          Check-in error
        </div>
        <div className="font-sans font-bold text-[color:var(--navy-ink)] text-lg mb-2">
          Something went wrong loading this page.
        </div>
        <div className="text-sm text-[color:var(--muted)] mb-5 break-words">
          {error.message || "Unknown error"}
        </div>
        <div className="flex gap-2 justify-center flex-wrap">
          <button
            type="button"
            onClick={reset}
            className="bg-navy text-white px-4 py-2 rounded text-sm font-semibold"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={reload}
            className="border border-[color:var(--rule)] text-[color:var(--navy-ink)] px-4 py-2 rounded text-sm font-semibold"
          >
            Reload page
          </button>
        </div>
        {error.digest && (
          <div className="mt-4 text-[10px] text-[color:var(--muted)] font-mono">
            digest {error.digest}
          </div>
        )}
      </div>
    </div>
  );
}
