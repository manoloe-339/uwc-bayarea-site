"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type SyncSummary = {
  scanned: number;
  created: number;
  updated: number;
  refunded: number;
  matchedHigh: number;
  matchedMedium: number;
  needsReview: number;
  unmatched: number;
  skipped: number;
  errors: string[];
};

export function SyncStripeButton({ slug, lastSyncedAt }: { slug: string; lastSyncedAt: string | null }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<SyncSummary | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();

  const run = async () => {
    setPending(true);
    setError(null);
    setSummary(null);
    try {
      const res = await fetch(`/api/ticket-events/${slug}/sync`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Sync failed (${res.status})`);
      }
      const data = (await res.json()) as SyncSummary;
      setSummary(data);
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={run}
          disabled={pending}
          className="text-sm font-semibold text-white bg-navy px-4 py-2 rounded hover:brightness-110 disabled:opacity-60"
        >
          {pending ? "Syncing…" : "Sync from Stripe"}
        </button>
        <span className="text-xs text-[color:var(--muted)]">
          {lastSyncedAt
            ? `Last synced ${new Date(lastSyncedAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`
            : "Never synced"}
        </span>
      </div>

      {pending && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-[1px]">
          <div className="bg-white rounded-[12px] shadow-xl px-7 py-6 flex items-center gap-4 max-w-[90vw]">
            <span className="inline-block w-6 h-6 border-[3px] border-navy border-t-transparent rounded-full animate-spin shrink-0" aria-hidden />
            <div>
              <div className="font-sans font-bold text-navy text-base">Syncing with Stripe…</div>
              <div className="text-xs text-[color:var(--muted)] mt-0.5">
                Fetching payments and matching to alumni.
              </div>
            </div>
          </div>
        </div>
      )}

      {!pending && summary && (
        <SyncResultModal summary={summary} onClose={() => setSummary(null)} />
      )}

      {!pending && error && (
        <SyncErrorModal error={error} onClose={() => setError(null)} />
      )}
    </>
  );
}

function SyncResultModal({ summary, onClose }: { summary: SyncSummary; onClose: () => void }) {
  const autoMatched = summary.matchedHigh;
  const mediumReview = summary.matchedMedium;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-[1px]">
      <div className="bg-white rounded-[12px] shadow-xl p-6 max-w-[440px] w-[90vw]">
        <h2 className="font-sans font-bold text-navy text-lg mb-3">Sync complete</h2>
        <dl className="text-sm space-y-1.5">
          <Row label="Sessions scanned" value={summary.scanned} />
          <Row label="New payments found" value={summary.created} accent={summary.created > 0} />
          <Row label="Updated" value={summary.updated} />
          {summary.refunded > 0 && <Row label="Refunded" value={summary.refunded} tone="red" />}
          <div className="pt-1 border-t border-[color:var(--rule)] mt-2" />
          <Row label="Auto-matched (high)" value={autoMatched} tone="green" />
          <Row
            label="Needs review (medium/low)"
            value={mediumReview + (summary.needsReview - mediumReview)}
            tone={summary.needsReview > 0 ? "yellow" : undefined}
          />
          <Row label="Unmatched" value={summary.unmatched} tone={summary.unmatched > 0 ? "red" : undefined} />
        </dl>
        {summary.errors.length > 0 && (
          <details className="mt-4 text-xs">
            <summary className="cursor-pointer text-red-700 font-semibold">
              {summary.errors.length} error{summary.errors.length === 1 ? "" : "s"}
            </summary>
            <ul className="mt-2 space-y-1 text-red-700">
              {summary.errors.map((e, i) => (
                <li key={i} className="break-words">{e}</li>
              ))}
            </ul>
          </details>
        )}
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="bg-navy text-white px-4 py-2 rounded text-sm font-semibold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function SyncErrorModal({ error, onClose }: { error: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-[1px]">
      <div className="bg-white rounded-[12px] shadow-xl p-6 max-w-[440px] w-[90vw]">
        <h2 className="font-sans font-bold text-red-800 text-lg mb-2">Sync failed</h2>
        <p className="text-sm text-[color:var(--navy-ink)] break-words">{error}</p>
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="bg-navy text-white px-4 py-2 rounded text-sm font-semibold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  accent,
  tone,
}: {
  label: string;
  value: number;
  accent?: boolean;
  tone?: "green" | "yellow" | "red";
}) {
  const valClass =
    tone === "green"
      ? "text-green-700"
      : tone === "yellow"
        ? "text-yellow-700"
        : tone === "red"
          ? "text-red-700"
          : accent
            ? "text-navy"
            : "text-[color:var(--navy-ink)]";
  return (
    <div className="flex items-baseline justify-between">
      <dt className="text-[color:var(--muted)]">{label}</dt>
      <dd className={`font-sans font-bold tabular-nums ${valClass}`}>{value.toLocaleString()}</dd>
    </div>
  );
}
