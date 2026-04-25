"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Candidate = { url: string; title: string; text: string; source: string };

type Props = {
  alumniId: number;
  candidates: Candidate[];
  chosenUrl: string | null;
};

export function ReviewActions({ alumniId, candidates, chosenUrl }: Props) {
  const initial = chosenUrl && candidates.find((c) => c.url === chosenUrl)?.url ? chosenUrl : candidates[0]?.url ?? null;
  const [picked, setPicked] = useState<string | null>(initial);
  const [customUrl, setCustomUrl] = useState("");
  const [submitting, setSubmitting] = useState<null | "approve" | "reject">(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();

  const approve = async () => {
    const url = (customUrl.trim() || picked || "").trim();
    if (!url) {
      setError("Pick a candidate or paste a different LinkedIn URL.");
      return;
    }
    setSubmitting("approve");
    setError(null);
    try {
      const res = await fetch("/api/enrichment/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alumni_id: alumniId, linkedin_url: url }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error ?? "Approve failed");
      }
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approve failed");
    } finally {
      setSubmitting(null);
    }
  };

  const reject = async () => {
    if (!confirm("Mark as no-LinkedIn-found? Status flips to failed (admin rejected).")) return;
    setSubmitting("reject");
    setError(null);
    try {
      const res = await fetch("/api/enrichment/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alumni_id: alumniId }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error ?? "Reject failed");
      }
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reject failed");
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <div>
      <ul className="space-y-2 mb-3">
        {candidates.map((c) => (
          <li
            key={c.url}
            className={`border rounded p-3 ${
              picked === c.url
                ? "border-navy bg-ivory-2"
                : "border-[color:var(--rule)]"
            }`}
          >
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="radio"
                name={`pick-${alumniId}`}
                checked={picked === c.url}
                onChange={() => {
                  setPicked(c.url);
                  setCustomUrl("");
                }}
                className="mt-1 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <a
                    href={c.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-semibold text-navy underline break-all"
                  >
                    {c.url}
                  </a>
                  {c.source && (
                    <span className="text-[10px] uppercase tracking-wider text-[color:var(--muted)] font-bold">
                      {c.source}
                    </span>
                  )}
                  {c.url === chosenUrl && (
                    <span className="text-[10px] uppercase tracking-wider text-emerald-700 font-bold">
                      Claude pick
                    </span>
                  )}
                </div>
                {c.title && (
                  <div className="text-xs text-[color:var(--navy-ink)] mt-0.5">{c.title}</div>
                )}
                {c.text && (
                  <div className="text-xs text-[color:var(--muted)] mt-0.5 italic">{c.text}</div>
                )}
              </div>
            </label>
          </li>
        ))}
      </ul>

      <label className="block mb-3">
        <span className="block text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-1">
          Or paste a different URL
        </span>
        <input
          type="url"
          placeholder="https://www.linkedin.com/in/…"
          value={customUrl}
          onChange={(e) => {
            setCustomUrl(e.target.value);
            if (e.target.value.trim()) setPicked(null);
          }}
          className="w-full border border-[color:var(--rule)] rounded px-3 py-2 text-sm bg-white"
        />
      </label>

      {error && <div className="text-sm text-red-700 mb-2">{error}</div>}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={approve}
          disabled={submitting !== null}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm font-semibold disabled:opacity-60"
        >
          {submitting === "approve" ? "Approving…" : "✓ Approve & scrape"}
        </button>
        <button
          type="button"
          onClick={reject}
          disabled={submitting !== null}
          className="border border-red-700 text-red-700 hover:bg-red-50 px-4 py-2 rounded text-sm font-semibold disabled:opacity-60"
        >
          {submitting === "reject" ? "Rejecting…" : "✗ No LinkedIn"}
        </button>
      </div>
    </div>
  );
}
