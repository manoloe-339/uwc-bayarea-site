import Link from "next/link";
import { notFound } from "next/navigation";
import { sql } from "@/lib/db";
import { fmtDateTime } from "@/lib/admin-time";

export const dynamic = "force-dynamic";

type RunRow = {
  id: number;
  started_at: string;
  finished_at: string | null;
  total_queries: number;
  total_hits: number;
  unique_urls: number;
  new_candidates: number;
  probable_matches: number;
  skipped_in_db: number;
  skipped_existing_candidate: number;
  cost_usd: string;
  error: string | null;
};

type LogRow = {
  id: number;
  query: string;
  source: string;
  group_label: string | null;
  hits_returned: number;
  unique_linkedin_urls: number;
  new_in_db: number;
  cost_usd: string;
  error: string | null;
};

export default async function RunDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isFinite(id)) notFound();

  const runs = (await sql`
    SELECT id, started_at, finished_at, total_queries, total_hits, unique_urls,
           new_candidates, probable_matches, skipped_in_db,
           skipped_existing_candidate, cost_usd, error
    FROM discovery_runs WHERE id = ${id}
  `) as RunRow[];
  const run = runs[0];
  if (!run) notFound();

  const logs = (await sql`
    SELECT id, query, source, group_label, hits_returned, unique_linkedin_urls,
           new_in_db, cost_usd, error
    FROM discovery_query_logs
    WHERE run_id = ${id}
    ORDER BY new_in_db DESC, unique_linkedin_urls DESC, query ASC
  `) as LogRow[];

  return (
    <div className="max-w-[1100px]">
      <div className="mb-4 text-sm">
        <Link href="/admin/tools/discover/runs" className="text-[color:var(--muted)] hover:text-navy">
          ← Discovery runs
        </Link>
      </div>

      <h1 className="font-sans text-3xl font-bold text-[color:var(--navy-ink)] mb-1">
        Run #{run.id}
      </h1>
      <p className="text-[color:var(--muted)] text-sm mb-6">
        {fmtDateTime(run.started_at)}
        {run.finished_at && ` → ${fmtDateTime(run.finished_at)}`}
      </p>

      <section className="grid sm:grid-cols-4 gap-3 mb-8">
        <Stat label="Queries" value={run.total_queries} />
        <Stat label="Total hits" value={run.total_hits} />
        <Stat label="Unique URLs" value={run.unique_urls} />
        <Stat label="New candidates" value={run.new_candidates} accent />
        <Stat label="Probable matches" value={run.probable_matches} />
        <Stat label="Already in DB" value={run.skipped_in_db} />
        <Stat label="Already candidate" value={run.skipped_existing_candidate} />
        <Stat label="Cost" value={`$${Number(run.cost_usd).toFixed(2)}`} />
      </section>

      {run.error && (
        <div className="mb-6 bg-rose-50 border border-rose-200 rounded p-3 text-sm text-rose-900">
          <strong>Run error:</strong> {run.error}
        </div>
      )}

      <h2 className="text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-3">
        Per-query breakdown ({logs.length})
      </h2>
      <p className="text-xs text-[color:var(--muted)] mb-3">
        Sorted by new candidates first. Queries that returned 0 unique URLs are
        likely too narrow or rate-limited.
      </p>
      <div className="bg-white border border-[color:var(--rule)] rounded-[10px] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-ivory-2 text-[11px] tracking-[.18em] uppercase font-bold text-[color:var(--muted)]">
            <tr>
              <th className="text-left px-4 py-2.5">Query</th>
              <th className="text-left px-4 py-2.5">Source</th>
              <th className="text-left px-4 py-2.5">Group</th>
              <th className="text-left px-4 py-2.5">Hits</th>
              <th className="text-left px-4 py-2.5">Unique URLs</th>
              <th className="text-left px-4 py-2.5">New</th>
              <th className="text-left px-4 py-2.5">Cost</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id} className="border-t border-[color:var(--rule)]">
                <td className="px-4 py-2 font-mono text-[11px] text-[color:var(--navy-ink)]">
                  {l.query}
                  {l.error && (
                    <span className="ml-2 text-[10px] text-rose-700">
                      error: {l.error}
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 text-xs text-[color:var(--muted)] uppercase">{l.source}</td>
                <td className="px-4 py-2 text-xs text-[color:var(--muted)]">{l.group_label}</td>
                <td className="px-4 py-2 text-xs">{l.hits_returned}</td>
                <td className="px-4 py-2 text-xs">{l.unique_linkedin_urls}</td>
                <td
                  className={`px-4 py-2 text-xs font-semibold ${
                    l.new_in_db === 0 ? "text-[color:var(--muted)]" : "text-emerald-700"
                  }`}
                >
                  {l.new_in_db}
                </td>
                <td className="px-4 py-2 text-[10px] text-[color:var(--muted)] tabular-nums">
                  ${Number(l.cost_usd).toFixed(3)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <div
      className={`bg-white border rounded-[10px] p-3 ${
        accent ? "border-emerald-300" : "border-[color:var(--rule)]"
      }`}
    >
      <div className="text-[11px] tracking-[.18em] uppercase font-bold text-[color:var(--muted)]">
        {label}
      </div>
      <div className={`mt-1 font-sans text-2xl font-bold ${accent ? "text-emerald-700" : "text-[color:var(--navy-ink)]"}`}>
        {value}
      </div>
    </div>
  );
}
