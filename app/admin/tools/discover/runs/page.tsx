import Link from "next/link";
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
  cost_usd: string;
};

type AggregateRow = {
  query: string;
  source: string;
  group_label: string | null;
  runs: number;
  total_new: number;
  total_hits: number;
  total_unique: number;
};

export default async function RunsListPage() {
  const runs = (await sql`
    SELECT id, started_at, finished_at, total_queries, total_hits, unique_urls,
           new_candidates, probable_matches, cost_usd
    FROM discovery_runs
    ORDER BY started_at DESC
    LIMIT 50
  `) as RunRow[];

  // Lifetime per-query yield, so admin can spot stale queries.
  const aggregate = (await sql`
    SELECT query, source, MAX(group_label) AS group_label,
           COUNT(*)::int AS runs,
           SUM(new_in_db)::int AS total_new,
           SUM(hits_returned)::int AS total_hits,
           SUM(unique_linkedin_urls)::int AS total_unique
    FROM discovery_query_logs
    GROUP BY query, source
    ORDER BY total_new DESC, total_unique DESC
    LIMIT 100
  `) as AggregateRow[];

  return (
    <div className="max-w-[1100px]">
      <div className="mb-4 text-sm">
        <Link href="/admin/tools/discover" className="text-[color:var(--muted)] hover:text-navy">
          ← Discover alumni
        </Link>
      </div>

      <h1 className="font-sans text-4xl font-bold text-[color:var(--navy-ink)] mb-1">
        Discovery runs
      </h1>
      <p className="text-[color:var(--muted)] text-sm mb-8">
        Audit every batch run + per-query yield. Click a run for the full breakdown.
      </p>

      <h2 className="text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-3">
        Recent runs
      </h2>
      {runs.length === 0 ? (
        <div className="bg-white border border-dashed border-[color:var(--rule)] rounded-[10px] p-8 text-center text-sm text-[color:var(--muted)]">
          No runs yet. Hit "Run discovery batch" on the Discover page.
        </div>
      ) : (
        <div className="bg-white border border-[color:var(--rule)] rounded-[10px] overflow-hidden mb-10">
          <table className="w-full text-sm">
            <thead className="bg-ivory-2 text-[11px] tracking-[.18em] uppercase font-bold text-[color:var(--muted)]">
              <tr>
                <th className="text-left px-4 py-2.5">When</th>
                <th className="text-left px-4 py-2.5">Queries</th>
                <th className="text-left px-4 py-2.5">Hits</th>
                <th className="text-left px-4 py-2.5">Unique URLs</th>
                <th className="text-left px-4 py-2.5">New candidates</th>
                <th className="text-left px-4 py-2.5">Probable matches</th>
                <th className="text-left px-4 py-2.5">Cost</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id} className="border-t border-[color:var(--rule)] hover:bg-ivory">
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/admin/tools/discover/runs/${r.id}`}
                      className="text-navy font-semibold hover:underline"
                    >
                      {fmtDateTime(r.started_at)}
                    </Link>
                    {!r.finished_at && (
                      <span className="ml-2 text-[10px] text-amber-700">running…</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">{r.total_queries}</td>
                  <td className="px-4 py-2.5">{r.total_hits}</td>
                  <td className="px-4 py-2.5">{r.unique_urls}</td>
                  <td className="px-4 py-2.5 font-semibold">{r.new_candidates}</td>
                  <td className="px-4 py-2.5">{r.probable_matches}</td>
                  <td className="px-4 py-2.5 text-xs text-[color:var(--muted)]">
                    ${Number(r.cost_usd).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {aggregate.length > 0 && (
        <>
          <h2 className="text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-3">
            Lifetime per-query yield (top 100)
          </h2>
          <p className="text-xs text-[color:var(--muted)] mb-3">
            Sorted by total new candidates contributed across all runs. Queries
            with consistent zero yield are prime candidates for retirement.
          </p>
          <div className="bg-white border border-[color:var(--rule)] rounded-[10px] overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-ivory-2 text-[11px] tracking-[.18em] uppercase font-bold text-[color:var(--muted)]">
                <tr>
                  <th className="text-left px-4 py-2.5">Query</th>
                  <th className="text-left px-4 py-2.5">Source</th>
                  <th className="text-left px-4 py-2.5">Group</th>
                  <th className="text-left px-4 py-2.5">Runs</th>
                  <th className="text-left px-4 py-2.5">Hits</th>
                  <th className="text-left px-4 py-2.5">Unique</th>
                  <th className="text-left px-4 py-2.5">New (lifetime)</th>
                </tr>
              </thead>
              <tbody>
                {aggregate.map((a, i) => (
                  <tr
                    key={`${a.query}::${a.source}::${i}`}
                    className="border-t border-[color:var(--rule)]"
                  >
                    <td className="px-4 py-2 font-mono text-[11px] text-[color:var(--navy-ink)]">
                      {a.query}
                    </td>
                    <td className="px-4 py-2 text-xs text-[color:var(--muted)] uppercase">{a.source}</td>
                    <td className="px-4 py-2 text-xs text-[color:var(--muted)]">{a.group_label}</td>
                    <td className="px-4 py-2 text-xs">{a.runs}</td>
                    <td className="px-4 py-2 text-xs">{a.total_hits}</td>
                    <td className="px-4 py-2 text-xs">{a.total_unique}</td>
                    <td className={`px-4 py-2 text-xs font-semibold ${a.total_new === 0 ? "text-[color:var(--muted)]" : "text-emerald-700"}`}>
                      {a.total_new}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
