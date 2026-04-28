"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Result = {
  ok: true;
  run_id: number;
  total_hits: number;
  unique_urls: number;
  inserted: number;
  skipped_already_in_db: number;
  skipped_already_candidate: number;
  probable_matches: number;
  possible_matches: number;
  cost_usd: number;
};

export default function DiscoverClient() {
  const [pending, setPending] = useState(false);
  const [retriaging, setRetriaging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [retriageMsg, setRetriageMsg] = useState<string | null>(null);
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

  const retriage = async () => {
    if (!confirm("Re-run Claude triage on all un-actioned candidates? Updates confidence/role labels with the latest prompt. ~$0.0001 per candidate, can take a couple minutes.")) {
      return;
    }
    setRetriaging(true);
    setRetriageMsg(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/discovery/re-triage", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "re-triage failed");
      setRetriageMsg(`Re-triaged ${data.retriaged} candidate${data.retriaged === 1 ? "" : "s"}${data.failed > 0 ? ` · ${data.failed} failed` : ""}.`);
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed");
    } finally {
      setRetriaging(false);
    }
  };

  return (
    <div className="bg-white border border-[color:var(--rule)] rounded-[10px] p-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-sm text-[color:var(--navy-ink)]">
            Runs 26 Serper queries, drops Western-Cape false positives, has
            Claude triage every hit (alum vs teacher · Bay Area vs not), then
            dedupes against the DB.
          </p>
          <p className="text-xs text-[color:var(--muted)] mt-1">
            Cost ≈ $0.05 per batch. Each run takes 1–2 minutes. Per-query
            yield is logged so you can audit what's working.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={retriage}
            disabled={pending || retriaging}
            title="Re-run Claude triage on un-actioned candidates with the latest prompt"
            className="text-sm font-semibold text-navy border border-navy px-4 py-2 rounded hover:bg-navy hover:text-white disabled:opacity-50"
          >
            {retriaging ? "Re-triaging…" : "Re-triage"}
          </button>
          <Link
            href="/admin/tools/discover/settings"
            className="text-sm font-semibold text-navy border border-navy px-4 py-2 rounded hover:bg-navy hover:text-white"
          >
            Settings
          </Link>
          <Link
            href="/admin/tools/discover/runs"
            className="text-sm font-semibold text-navy border border-navy px-4 py-2 rounded hover:bg-navy hover:text-white"
          >
            View runs →
          </Link>
          <button
            type="button"
            onClick={run}
            disabled={pending || retriaging}
            className="bg-navy text-white px-5 py-2.5 rounded text-sm font-semibold disabled:opacity-60 inline-flex items-center gap-2"
          >
            {pending && (
              <svg
                aria-hidden
                className="animate-spin h-4 w-4 text-white"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                />
              </svg>
            )}
            {pending ? "Running…" : "Run discovery batch"}
          </button>
        </div>
      </div>

      {pending && (
        <div className="mt-3 text-sm bg-amber-50 border border-amber-200 rounded p-3 text-amber-900 flex items-start gap-3">
          <span className="mt-0.5 inline-block w-2 h-2 rounded-full bg-amber-600 animate-pulse" />
          <div>
            <strong>Discovery in progress.</strong> Searching, filtering Western
            Cape false positives, then Claude-triaging each unique URL. Don't
            close this tab — should finish in 1–2 minutes.
          </div>
        </div>
      )}

      {retriaging && (
        <div className="mt-3 text-sm bg-amber-50 border border-amber-200 rounded p-3 text-amber-900 flex items-start gap-3">
          <span className="mt-0.5 inline-block w-2 h-2 rounded-full bg-amber-600 animate-pulse" />
          <div>
            <strong>Re-triaging candidates.</strong> Re-running Claude on every
            un-actioned candidate with the latest prompt. Don't close this tab.
          </div>
        </div>
      )}

      {retriageMsg && !retriaging && (
        <div className="mt-3 text-sm bg-emerald-50 border border-emerald-200 rounded p-2 text-emerald-900">
          {retriageMsg}
        </div>
      )}

      {error && (
        <div className="mt-3 text-sm bg-rose-50 border border-rose-200 rounded p-2 text-rose-900">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-3 text-sm bg-emerald-50 border border-emerald-200 rounded p-3 text-emerald-900">
          <strong>{result.inserted} new candidate{result.inserted === 1 ? "" : "s"}</strong>
          {" "}stored. Cost ${result.cost_usd.toFixed(2)}.
          <span className="text-emerald-800/80">
            {" · "}
            {result.total_hits} total hits → {result.unique_urls} unique URLs ·{" "}
            {result.probable_matches} probable matches ·{" "}
            {result.skipped_already_in_db} already in DB ·{" "}
            {result.skipped_already_candidate} already a candidate
          </span>
          {" "}
          <Link
            href={`/admin/tools/discover/runs/${result.run_id}`}
            className="underline font-semibold"
          >
            See per-query breakdown →
          </Link>
        </div>
      )}
    </div>
  );
}
