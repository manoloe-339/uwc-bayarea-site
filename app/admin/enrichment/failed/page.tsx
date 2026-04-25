import Link from "next/link";
import { sql } from "@/lib/db";
import { RetryButton } from "@/components/enrichment/RetryButton";

export const dynamic = "force-dynamic";

type Row = {
  id: number;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  linkedin_url: string | null;
  linkedin_enrichment_error: string | null;
  linkedin_enriched_at: string | null;
};

function isAdminRejected(err: string | null): boolean {
  return !!err && /admin rejected/i.test(err);
}

export default async function FailedEnrichmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>;
}) {
  const { kind } = await searchParams;
  const showKind = kind === "rejected" || kind === "api" ? kind : "api";

  const rows = (await sql`
    SELECT id, first_name, last_name, email, linkedin_url,
           linkedin_enrichment_error, linkedin_enriched_at
    FROM alumni
    WHERE linkedin_enrichment_status = 'failed'
      AND deceased IS NOT TRUE
    ORDER BY linkedin_enriched_at DESC NULLS LAST, id DESC
    LIMIT 200
  `) as Row[];

  const visible = rows.filter((r) =>
    showKind === "rejected" ? isAdminRejected(r.linkedin_enrichment_error) : !isAdminRejected(r.linkedin_enrichment_error)
  );
  const apiCount = rows.filter((r) => !isAdminRejected(r.linkedin_enrichment_error)).length;
  const rejectedCount = rows.length - apiCount;

  return (
    <div className="max-w-[900px]">
      <div className="mb-4 text-sm">
        <Link href="/admin/enrichment" className="text-[color:var(--muted)] hover:text-navy">
          ← Enrichment
        </Link>
      </div>
      <h1 className="font-sans text-4xl font-bold text-[color:var(--navy-ink)] mb-1">Failed</h1>
      <p className="text-[color:var(--muted)] text-sm mb-4">
        Rows whose enrichment ended in failure. Admin-rejected rows are kept separate so debug
        focuses on real API issues.
      </p>

      <div className="flex gap-1 mb-4 text-sm font-semibold">
        <Tab href="/admin/enrichment/failed?kind=api" active={showKind === "api"} count={apiCount}>
          API failures
        </Tab>
        <Tab href="/admin/enrichment/failed?kind=rejected" active={showKind === "rejected"} count={rejectedCount}>
          Admin-rejected
        </Tab>
      </div>

      {visible.length === 0 ? (
        <div className="bg-white border border-dashed border-[color:var(--rule)] rounded-[10px] p-8 text-center text-sm text-[color:var(--muted)]">
          Nothing in this view.
        </div>
      ) : (
        <ul className="space-y-2">
          {visible.map((r) => (
            <li
              key={r.id}
              className="bg-white border border-[color:var(--rule)] rounded-[10px] p-4"
            >
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/admin/alumni/${r.id}`}
                    className="font-semibold text-navy hover:underline"
                  >
                    {[r.first_name, r.last_name].filter(Boolean).join(" ") || `#${r.id}`}
                  </Link>
                  <div className="text-xs text-[color:var(--muted)] mt-0.5 break-all">
                    {r.email ?? "—"}
                  </div>
                  {r.linkedin_url && (
                    <div className="text-xs mt-0.5 break-all">
                      <a
                        href={r.linkedin_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-navy hover:underline"
                      >
                        {r.linkedin_url}
                      </a>
                    </div>
                  )}
                  <div className="text-xs text-red-700 mt-1 break-words">
                    {r.linkedin_enrichment_error ?? "(no error captured)"}
                  </div>
                  {r.linkedin_enriched_at && (
                    <div className="text-[10px] text-[color:var(--muted)] mt-0.5">
                      Last attempt:{" "}
                      {new Date(r.linkedin_enriched_at).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2 shrink-0">
                  <RetryButton alumniId={r.id} />
                  <Link
                    href={`/admin/alumni/${r.id}#enrichment`}
                    className="text-sm text-[color:var(--muted)] hover:text-navy text-right"
                  >
                    Manual fix →
                  </Link>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Tab({
  href, active, count, children,
}: {
  href: string;
  active: boolean;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`px-3 py-1.5 rounded border text-sm ${
        active
          ? "bg-navy text-white border-navy"
          : "bg-white text-navy border-[color:var(--rule)] hover:border-navy"
      }`}
    >
      {children}{" "}
      <span className={`text-xs ${active ? "text-white/70" : "text-[color:var(--muted)]"}`}>
        ({count})
      </span>
    </Link>
  );
}
