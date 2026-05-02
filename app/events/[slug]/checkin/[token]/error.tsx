"use client";

import { useEffect, useState } from "react";

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
  const [debugInfo, setDebugInfo] = useState<string>("");

  useEffect(() => {
    // Surface the error in the browser console for debugging.
    console.error("[checkin] error boundary caught:", error);
    // Build a debug blob with everything we can discover. Useful when
    // error.message is empty (minified production errors / non-Error
    // throws) — we try every property we know of.
    const lines: string[] = [];
    lines.push(`name: ${error.name || "(none)"}`);
    lines.push(`message: ${error.message || "(empty)"}`);
    if (error.digest) lines.push(`digest: ${error.digest}`);
    if (error.stack) {
      const trimmed = error.stack.split("\n").slice(0, 6).join("\n");
      lines.push(`stack:\n${trimmed}`);
    }
    // Also stringify any extra props the error might carry (esp. for
    // non-Error throws like `throw { code: ... }`)
    try {
      const extra = Object.fromEntries(
        Object.getOwnPropertyNames(error)
          .filter((k) => !["name", "message", "stack", "digest"].includes(k))
          .map((k) => [k, (error as unknown as Record<string, unknown>)[k]])
      );
      if (Object.keys(extra).length > 0) {
        lines.push(`extra: ${JSON.stringify(extra).slice(0, 400)}`);
      }
    } catch {
      // ignore
    }
    setDebugInfo(lines.join("\n"));
  }, [error]);

  const reload = () => {
    if (typeof window !== "undefined") window.location.reload();
  };

  const copyDebug = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(debugInfo).catch(() => {});
    }
  };

  return (
    <div className="min-h-screen bg-ivory flex items-center justify-center p-5">
      <div className="bg-white border border-[color:var(--rule)] rounded-[12px] p-6 max-w-[480px] w-full">
        <div className="text-[11px] tracking-[.22em] uppercase font-bold text-rose-700 mb-2 text-center">
          Check-in error
        </div>
        <div className="font-sans font-bold text-[color:var(--navy-ink)] text-lg mb-2 text-center">
          Something went wrong loading this page.
        </div>
        <div className="text-sm text-[color:var(--muted)] mb-5 break-words text-center">
          {error.message || (error.digest ? `Server error · digest ${error.digest}` : "Client error (see details below)")}
        </div>
        <div className="flex gap-2 justify-center flex-wrap mb-4">
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
        {debugInfo && (
          <details className="mt-3">
            <summary className="text-[11px] tracking-[.18em] uppercase font-bold text-[color:var(--muted)] cursor-pointer">
              Details (for support)
            </summary>
            <pre className="mt-2 text-[10px] bg-ivory-2 border border-[color:var(--rule)] rounded p-2 overflow-auto whitespace-pre-wrap break-words font-mono leading-snug max-h-[260px]">
              {debugInfo}
            </pre>
            <button
              type="button"
              onClick={copyDebug}
              className="mt-2 text-[11px] text-navy underline"
            >
              Copy details
            </button>
          </details>
        )}
      </div>
    </div>
  );
}
