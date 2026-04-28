"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Candidate = {
  id: number;
  linkedin_url: string;
  name_guess: string | null;
  title_snippet: string | null;
  body_snippet: string | null;
  source: string | null;
  search_query: string | null;
  status: "new" | "probable_match" | "possible_match" | "scraped" | "added" | "rejected";
  matched_alumni_id: number | null;
  scraped_data: unknown;
  discovered_at: string;
  triage_confidence: "high" | "medium" | "low" | null;
  triage_role: "alum" | "teacher" | "staff" | "unrelated" | null;
  triage_reasoning: string | null;
};

const CONF_STYLE: Record<"high" | "medium" | "low", string> = {
  high:   "bg-emerald-600 text-white border-emerald-700",
  medium: "bg-amber-500 text-white border-amber-600",
  low:    "bg-[color:var(--muted)] text-white border-[color:var(--muted)]",
};

const ROLE_STYLE: Record<string, string> = {
  alum:       "bg-emerald-50 text-emerald-700 border-emerald-200",
  teacher:    "bg-amber-50 text-amber-700 border-amber-200",
  staff:      "bg-amber-50 text-amber-700 border-amber-200",
  unrelated:  "bg-rose-50 text-rose-700 border-rose-200",
};

export default function CandidateCard({ candidate }: { candidate: Candidate }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState<"scrape" | "add" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const sd = (candidate.scraped_data ?? {}) as Record<string, unknown>;
  const sdName = [sd.firstName, sd.lastName].filter(Boolean).join(" ");
  const headline = typeof sd.headline === "string" ? sd.headline : null;
  const company = typeof sd.companyName === "string" ? sd.companyName : null;
  const title = typeof sd.jobTitle === "string" ? sd.jobTitle : null;

  const refresh = () => startTransition(() => router.refresh());

  const scrape = async () => {
    setBusy("scrape");
    setError(null);
    try {
      const res = await fetch("/api/admin/discovery/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: candidate.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "scrape failed");
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed");
    } finally {
      setBusy(null);
    }
  };

  const reject = async () => {
    if (!confirm("Reject this candidate?")) return;
    setBusy("reject");
    setError(null);
    try {
      const res = await fetch("/api/admin/discovery/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: candidate.id }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "reject failed");
      }
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed");
    } finally {
      setBusy(null);
    }
  };

  const displayName = sdName || candidate.name_guess || "(no name detected)";

  return (
    <div className="bg-white border border-[color:var(--rule)] rounded-[10px] p-4">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {candidate.triage_confidence && (
              <span className={`text-[10px] tracking-[.1em] uppercase font-bold px-2 py-0.5 rounded border ${CONF_STYLE[candidate.triage_confidence]}`}>
                {candidate.triage_confidence}
              </span>
            )}
            {candidate.triage_role && (
              <span className={`text-[10px] tracking-[.1em] uppercase font-bold px-2 py-0.5 rounded border ${ROLE_STYLE[candidate.triage_role] ?? "bg-[color:var(--rule)] text-[color:var(--muted)]"}`}>
                {candidate.triage_role}
              </span>
            )}
            <span className="font-bold text-[color:var(--navy-ink)]">{displayName}</span>
            <a
              href={candidate.linkedin_url}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-navy hover:underline font-mono"
            >
              {candidate.linkedin_url.replace(/^https?:\/\/(www\.)?/, "")}
            </a>
          </div>
          {candidate.triage_reasoning && (
            <p className="text-[11px] text-[color:var(--muted)] italic mb-1">
              {candidate.triage_reasoning}
            </p>
          )}
          {(headline || candidate.title_snippet) && (
            <p className="text-sm text-[color:var(--muted)] mt-1 line-clamp-2">
              {headline ?? candidate.title_snippet}
            </p>
          )}
          {(company || title) && (
            <p className="text-xs text-[color:var(--navy-ink)] mt-1">
              {[title, company].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
        {candidate.matched_alumni_id && (
          <Link
            href={`/admin/alumni/${candidate.matched_alumni_id}`}
            className="text-xs font-semibold text-amber-700 border border-amber-300 px-2 py-0.5 rounded hover:bg-amber-50"
          >
            ⚠ Possible match #{candidate.matched_alumni_id}
          </Link>
        )}
      </div>

      {candidate.body_snippet && (
        <p className="text-xs text-[color:var(--muted)] mt-2 italic line-clamp-2">
          {candidate.body_snippet}
        </p>
      )}

      <div className="text-[11px] text-[color:var(--muted)] mt-2">
        via {candidate.source} · query: <code className="font-mono">{candidate.search_query}</code>
      </div>

      {error && (
        <div className="mt-2 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded px-2 py-1">
          {error}
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2 items-center">
        {candidate.status !== "added" && candidate.status !== "rejected" && (
          <>
            {candidate.status !== "scraped" && (
              <button
                type="button"
                onClick={scrape}
                disabled={busy !== null}
                className="text-xs font-semibold bg-navy text-white px-3 py-1.5 rounded disabled:opacity-50"
              >
                {busy === "scrape" ? "Scraping…" : "Scrape via Apify"}
              </button>
            )}
            {candidate.status === "scraped" && (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="text-xs font-semibold text-navy border border-navy px-3 py-1.5 rounded hover:bg-navy hover:text-white"
              >
                {expanded ? "Hide" : "Add to alumni"}
              </button>
            )}
            <button
              type="button"
              onClick={reject}
              disabled={busy !== null}
              className="text-xs font-semibold text-rose-700 border border-rose-200 px-3 py-1.5 rounded hover:bg-rose-50 disabled:opacity-50"
            >
              {busy === "reject" ? "…" : "Reject"}
            </button>
          </>
        )}
      </div>

      {expanded && candidate.status === "scraped" && (
        <AddForm
          candidateId={candidate.id}
          defaultFirst={(sd.firstName as string) ?? candidate.name_guess?.split(" ")[0] ?? ""}
          defaultLast={(sd.lastName as string) ?? candidate.name_guess?.split(" ").slice(1).join(" ") ?? ""}
          onAdded={refresh}
        />
      )}
    </div>
  );
}

function AddForm({
  candidateId,
  defaultFirst,
  defaultLast,
  onAdded,
}: {
  candidateId: number;
  defaultFirst: string;
  defaultLast: string;
  onAdded: () => void;
}) {
  const [email, setEmail] = useState("");
  const [first, setFirst] = useState(defaultFirst);
  const [last, setLast] = useState(defaultLast);
  const [college, setCollege] = useState("");
  const [gradYear, setGradYear] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!email.trim()) {
      setError("Email is required.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/discovery/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidate_id: candidateId,
          email: email.trim(),
          first_name: first.trim() || null,
          last_name: last.trim() || null,
          uwc_college: college.trim() || null,
          grad_year: gradYear.trim() ? Number(gradYear.trim()) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "add failed");
      onAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-3 p-3 bg-ivory-2 border border-[color:var(--rule)] rounded space-y-2">
      <div className="grid sm:grid-cols-2 gap-2 text-xs">
        <Field label="First name" value={first} onChange={setFirst} />
        <Field label="Last name" value={last} onChange={setLast} />
        <Field label="Email (required)" value={email} onChange={setEmail} type="email" />
        <Field label="UWC college" value={college} onChange={setCollege} placeholder="e.g. UWC Mostar" />
        <Field label="Grad year" value={gradYear} onChange={setGradYear} placeholder="e.g. 2010" />
      </div>
      {error && <div className="text-xs text-rose-700">{error}</div>}
      <button
        type="button"
        onClick={submit}
        disabled={submitting}
        className="text-xs font-semibold bg-emerald-700 text-white px-3 py-1.5 rounded disabled:opacity-50"
      >
        {submitting ? "Adding…" : "Add to alumni DB"}
      </button>
    </div>
  );
}

function Field({
  label, value, onChange, placeholder, type = "text",
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <label className="block">
      <span className="block text-[11px] tracking-[.18em] uppercase font-bold text-[color:var(--muted)] mb-0.5">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-[color:var(--rule)] rounded px-2 py-1 text-xs bg-white"
      />
    </label>
  );
}
