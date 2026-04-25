import Link from "next/link";
import { sql } from "@/lib/db";
import { ReviewActions } from "@/components/enrichment/ReviewActions";

export const dynamic = "force-dynamic";

type Row = {
  id: number;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  uwc_college: string | null;
  grad_year: number | null;
  current_company: string | null;
  current_city: string | null;
  linkedin_enriched_at: string | null;
  linkedin_enrichment_error: string | null;
  raw: unknown;
};

type RawShape = {
  decision?: { chosen_url?: string | null; confidence?: string; reasoning?: string };
  candidates?: Array<{
    url: string;
    title?: string;
    text?: string;
    source?: string;
  }>;
  attemptedUrl?: string;
  apifyRunId?: string;
  apifyLogTail?: string;
};

export default async function EnrichmentReviewPage() {
  const rows = (await sql`
    SELECT id, first_name, last_name, email, uwc_college, grad_year,
           current_company, current_city, linkedin_enriched_at,
           linkedin_enrichment_error,
           linkedin_raw_data AS raw
    FROM alumni
    WHERE linkedin_enrichment_status = 'needs_review'
      AND deceased IS NOT TRUE
    ORDER BY linkedin_enriched_at DESC NULLS LAST, id DESC
    LIMIT 100
  `) as Row[];

  return (
    <div className="max-w-[900px]">
      <div className="mb-4 text-sm">
        <Link href="/admin/enrichment" className="text-[color:var(--muted)] hover:text-navy">
          ← Enrichment
        </Link>
      </div>
      <h1 className="font-sans text-4xl font-bold text-[color:var(--navy-ink)] mb-1">
        Review queue
      </h1>
      <p className="text-[color:var(--muted)] text-sm mb-6">
        {rows.length === 0
          ? "Nothing to review."
          : `${rows.length} record${rows.length === 1 ? "" : "s"} where Claude couldn't pick a confident match.`}
      </p>

      {rows.length === 0 ? (
        <div className="bg-white border border-dashed border-[color:var(--rule)] rounded-[10px] p-8 text-center text-sm text-[color:var(--muted)]">
          🎉 Nothing here.
        </div>
      ) : (
        <ul className="space-y-4">
          {rows.map((r) => {
            const raw = (r.raw ?? {}) as RawShape;
            const candidates = Array.isArray(raw.candidates) ? raw.candidates : [];
            const decision = raw.decision ?? null;
            return (
              <li
                key={r.id}
                className="bg-white border border-[color:var(--rule)] rounded-[10px] p-5"
              >
                <header className="mb-3 flex items-baseline justify-between flex-wrap gap-2">
                  <div>
                    <Link
                      href={`/admin/alumni/${r.id}`}
                      className="font-sans text-lg font-bold text-navy hover:underline"
                    >
                      {[r.first_name, r.last_name].filter(Boolean).join(" ") || `#${r.id}`}
                    </Link>
                    <div className="text-xs text-[color:var(--muted)] mt-0.5">
                      {r.email ?? "—"}
                      {r.uwc_college ? ` · ${r.uwc_college}` : ""}
                      {r.grad_year ? ` '${String(r.grad_year).slice(-2)}` : ""}
                      {r.current_company ? ` · ${r.current_company}` : ""}
                      {r.current_city ? ` · ${r.current_city}` : ""}
                    </div>
                  </div>
                </header>

                {decision && (
                  <div className="text-xs text-[color:var(--muted)] mb-3 italic">
                    Claude: {decision.confidence ?? "—"} confidence — {decision.reasoning || r.linkedin_enrichment_error || "(no reasoning)"}
                  </div>
                )}

                {raw.attemptedUrl && candidates.length === 0 && (
                  <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 mb-3">
                    Apify scrape failed on{" "}
                    <a
                      href={raw.attemptedUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono break-all underline"
                    >
                      {raw.attemptedUrl}
                    </a>
                    {raw.apifyRunId && (
                      <span className="ml-2">
                        (Apify run{" "}
                        <code className="font-mono">{raw.apifyRunId}</code>)
                      </span>
                    )}
                  </div>
                )}

                {candidates.length === 0 ? (
                  <p className="text-sm text-[color:var(--muted)]">
                    No candidate list captured. Use{" "}
                    <Link
                      href={`/admin/alumni/${r.id}`}
                      className="text-navy hover:underline"
                    >
                      manual override
                    </Link>{" "}
                    to enter data.
                  </p>
                ) : (
                  <ReviewActions
                    alumniId={r.id}
                    candidates={candidates.map((c) => ({
                      url: c.url,
                      title: c.title ?? "",
                      text: (c.text ?? "").slice(0, 200),
                      source: c.source ?? "",
                    }))}
                    chosenUrl={decision?.chosen_url ?? null}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
