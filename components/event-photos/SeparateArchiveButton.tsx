"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type ResultEvent = {
  eventId: number;
  slug: string;
  name: string;
  date: string;
  movedCount: number;
  isNew: boolean;
};

type Result = {
  events: ResultEvent[];
  totalMoved: number;
  skippedNoDate: number;
};

export function SeparateArchiveButton() {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onClick = async () => {
    if (busy) return;
    if (
      !confirm(
        "Run event separation? Groups archive photos by date (3-day gap) and moves them into per-date event galleries. Safe to run repeatedly."
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/event-photos/separate-archive", {
        method: "POST",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as Result;
      setResult(data);
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb-6 bg-white border border-[color:var(--rule)] rounded-[10px] p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-[260px]">
          <h3 className="text-sm font-semibold text-[color:var(--navy-ink)] mb-1">
            Event separation
          </h3>
          <p className="text-xs text-[color:var(--muted)] max-w-prose">
            Groups photos in this archive by capture date (3-day gap) and moves
            them into per-date event galleries. Star (marquee) tags carry over.
            Photos without an EXIF date stay in archive. Safe to run repeatedly
            — already-moved photos won&rsquo;t move again.
          </p>
        </div>
        <button
          type="button"
          onClick={onClick}
          disabled={busy}
          className="text-sm font-semibold text-white bg-navy px-4 py-2 rounded hover:opacity-90 disabled:opacity-50 whitespace-nowrap"
        >
          {busy ? "Running…" : "Run event separation"}
        </button>
      </div>

      {error && (
        <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded text-xs text-rose-900">
          Failed: {error}
        </div>
      )}

      {result && (
        <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded text-xs">
          <p className="font-semibold text-emerald-900 mb-2">
            ✓ Moved {result.totalMoved} photo
            {result.totalMoved === 1 ? "" : "s"} into {result.events.length}{" "}
            event{result.events.length === 1 ? "" : "s"}
            {result.skippedNoDate > 0 && (
              <span className="font-normal text-[color:var(--muted)]">
                {" "}
                · skipped {result.skippedNoDate} (no EXIF date — left in archive)
              </span>
            )}
          </p>
          {result.events.length === 0 ? (
            <p className="text-[color:var(--muted)]">
              Nothing new to move. Either archive is empty, all photos already
              landed in events, or no archive photos have an EXIF date yet.
            </p>
          ) : (
            <ul className="space-y-1">
              {result.events.map((e) => (
                <li key={e.eventId} className="flex items-baseline gap-2 flex-wrap">
                  <Link
                    href={`/admin/events/${e.slug}/photos`}
                    className="text-navy font-semibold hover:underline"
                  >
                    {e.name}
                  </Link>
                  <span className="text-[color:var(--muted)]">
                    · {e.movedCount} photo{e.movedCount === 1 ? "" : "s"} ·{" "}
                    {e.isNew ? "new event" : "merged into existing event"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
