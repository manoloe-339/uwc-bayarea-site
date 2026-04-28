"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Result = {
  ok: true;
  total_hits: number;
  inserted: number;
  skipped_already_in_db: number;
  skipped_already_candidate: number;
  probable_matches: number;
};

export default function DiscoverClient() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const router = useRouter();
  const [, startTransition] = useTransition();

  const run = async () => {
    setPending(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/discovery/run", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "discovery failed");
      setResult(data);
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="bg-white border border-[color:var(--rule)] rounded-[10px] p-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-sm text-[color:var(--navy-ink)]">
            Runs 18 search queries across Serper + Exa, dedupes against the alumni
            DB, and stores new candidates below for review.
          </p>
          <p className="text-xs text-[color:var(--muted)] mt-1">
            Cost ≈ $0.12 per batch. Each run takes 1–2 minutes.
          </p>
        </div>
        <button
          type="button"
          onClick={run}
          disabled={pending}
          className="bg-navy text-white px-5 py-2.5 rounded text-sm font-semibold disabled:opacity-50"
        >
          {pending ? "Running…" : "Run discovery batch"}
        </button>
      </div>

      {error && (
        <div className="mt-3 text-sm bg-rose-50 border border-rose-200 rounded p-2 text-rose-900">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-3 text-sm bg-emerald-50 border border-emerald-200 rounded p-3 text-emerald-900">
          <strong>{result.inserted} new candidate{result.inserted === 1 ? "" : "s"}</strong>
          {" "}stored.
          <span className="text-emerald-800/80">
            {" · "}
            {result.total_hits} total hits ·{" "}
            {result.probable_matches} probable matches against existing alumni ·{" "}
            {result.skipped_already_in_db} already in DB ·{" "}
            {result.skipped_already_candidate} already a candidate
          </span>
        </div>
      )}
    </div>
  );
}
