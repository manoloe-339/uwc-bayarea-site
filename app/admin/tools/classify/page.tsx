import Link from "next/link";
import { listCompaniesWithClassifications } from "@/lib/company-classifications";
import { fmtDate } from "@/lib/admin-time";
import { runClassifierAction, classifyOneAction } from "./actions";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // Allow up to 5 min for a full classify run (Fluid Compute)

function fmtBool(v: boolean | null): React.ReactNode {
  if (v === true) return <span className="text-green-800">Yes</span>;
  if (v === false) return <span className="text-[color:var(--muted)]">No</span>;
  return <span className="text-[color:var(--muted)]">—</span>;
}

export default async function ClassifyPage() {
  const companies = await listCompaniesWithClassifications();
  const unclassified = companies.filter((c) => c.classified_at == null);
  const classified = companies.filter((c) => c.classified_at != null);
  const lowConf = classified.filter((c) => (c.confidence ?? 0) < 0.6);

  return (
    <div className="max-w-[1100px]">
      <div className="mb-4 text-sm">
        <Link href="/admin" className="text-[color:var(--muted)] hover:text-navy">
          ← Admin home
        </Link>
      </div>
      <h1 className="font-sans text-4xl font-bold text-[color:var(--navy-ink)] mb-1">
        Company classifier
      </h1>
      <p className="text-[color:var(--muted)] text-sm mb-6">
        Uses Claude Haiku to label each unique company as tech/non-tech, startup/established,
        public/private, subsidiary/independent, plus a sector. LinkedIn&rsquo;s own industry tags
        are too coarse for filters like &ldquo;non-tech&rdquo; — this fills the gap.
      </p>

      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        <Stat label="Total companies" value={companies.length} />
        <Stat label="Classified" value={classified.length} accent={classified.length > 0} />
        <Stat label="Unclassified" value={unclassified.length} accent={unclassified.length > 0} />
      </div>

      <form action={runClassifierAction} className="bg-white border border-[color:var(--rule)] rounded-[10px] p-5 mb-6 flex items-center gap-4">
        <div className="flex-1">
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name="scope" value="unclassified" defaultChecked />
            Only unclassified ({unclassified.length})
          </label>
          <label className="flex items-center gap-2 text-sm mt-1">
            <input type="radio" name="scope" value="all" />
            Re-classify all ({companies.length}) — overwrites existing labels
          </label>
        </div>
        <button
          type="submit"
          disabled={companies.length === 0}
          className="bg-navy text-white px-5 py-2.5 rounded text-sm font-semibold disabled:opacity-50"
        >
          Run classifier →
        </button>
      </form>

      {lowConf.length > 0 && (
        <div className="mb-4 p-3 bg-orange-50 border-l-4 border-orange-400 rounded-[2px] text-sm">
          <span className="font-semibold text-orange-800">{lowConf.length} low-confidence {lowConf.length === 1 ? "label" : "labels"}</span>
          <span className="text-orange-800"> worth reviewing manually below.</span>
        </div>
      )}

      <section className="bg-white border border-[color:var(--rule)] rounded-[10px] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-ivory-2 text-[11px] tracking-[.18em] uppercase font-bold text-[color:var(--muted)]">
            <tr>
              <th className="text-left px-3 py-2">Company</th>
              <th className="text-left px-3 py-2">Alumni</th>
              <th className="text-left px-3 py-2">LinkedIn industry</th>
              <th className="text-center px-3 py-2">Tech</th>
              <th className="text-center px-3 py-2">Startup</th>
              <th className="text-left px-3 py-2">Sector</th>
              <th className="text-left px-3 py-2">Reasoning</th>
              <th className="text-right px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {companies.map((c) => {
              const classifyOne = classifyOneAction.bind(null, c.company_key);
              const isLow = c.confidence != null && c.confidence < 0.6;
              return (
                <tr key={c.company_key} className={`border-t border-[color:var(--rule)] align-top ${isLow ? "bg-orange-50/50" : ""}`}>
                  <td className="px-3 py-2">
                    <div className="font-semibold text-navy">{c.company_name}</div>
                  </td>
                  <td className="px-3 py-2 text-xs">{c.alumni_count}</td>
                  <td className="px-3 py-2 text-xs text-[color:var(--muted)]">
                    {c.industry ?? "—"}
                    {c.size ? ` · ${c.size}` : ""}
                  </td>
                  <td className="px-3 py-2 text-center text-xs">{fmtBool(c.is_tech)}</td>
                  <td className="px-3 py-2 text-center text-xs">{fmtBool(c.is_startup)}</td>
                  <td className="px-3 py-2 text-xs">{c.sector ?? "—"}</td>
                  <td className="px-3 py-2 text-xs text-[color:var(--navy-ink)] max-w-[280px]">
                    {c.reasoning ? (
                      <div>
                        {c.reasoning}
                        {c.confidence != null && (
                          <span className="ml-1 text-[10px] text-[color:var(--muted)]">
                            · conf {c.confidence.toFixed(2)}
                          </span>
                        )}
                        {c.classified_at && (
                          <div className="text-[10px] text-[color:var(--muted)] mt-0.5">
                            {fmtDate(c.classified_at)}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-[color:var(--muted)] italic">Not yet classified</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <form action={classifyOne}>
                      <button
                        type="submit"
                        className="text-[11px] text-navy hover:underline"
                        aria-label={`Re-classify ${c.company_name}`}
                      >
                        {c.classified_at ? "Re-run" : "Classify"}
                      </button>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className={`bg-white border ${accent ? "border-navy" : "border-[color:var(--rule)]"} rounded-[10px] p-4`}>
      <div className="text-[11px] tracking-[.22em] uppercase font-bold text-[color:var(--muted)]">{label}</div>
      <div className="text-3xl font-sans font-bold text-[color:var(--navy-ink)] mt-1">{value}</div>
    </div>
  );
}
