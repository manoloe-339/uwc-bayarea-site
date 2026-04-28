import Link from "next/link";
import { sql } from "@/lib/db";
import DiscoverClient from "./DiscoverClient";
import CandidateCard from "./CandidateCard";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type CandidateRow = {
  id: number;
  linkedin_url: string;
  name_guess: string | null;
  title_snippet: string | null;
  body_snippet: string | null;
  source: string | null;
  search_query: string | null;
  status: "new" | "probable_match" | "scraped" | "added" | "rejected";
  matched_alumni_id: number | null;
  scraped_data: unknown;
  discovered_at: string;
};

const LABEL: Record<CandidateRow["status"], string> = {
  new: "New",
  probable_match: "Probable matches",
  scraped: "Scraped",
  added: "Added",
  rejected: "Rejected",
};

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab: tabRaw } = await searchParams;
  const tab: CandidateRow["status"] = (
    ["new", "probable_match", "scraped", "added", "rejected"] as const
  ).includes(tabRaw as CandidateRow["status"])
    ? (tabRaw as CandidateRow["status"])
    : "new";

  const counts = (await sql`
    SELECT status, COUNT(*)::int AS n
    FROM alumni_candidates GROUP BY status
  `) as { status: string; n: number }[];
  const countByStatus: Record<string, number> = Object.fromEntries(
    counts.map((c) => [c.status, c.n])
  );

  const rows = (await sql`
    SELECT id, linkedin_url, name_guess, title_snippet, body_snippet,
           source, search_query, status, matched_alumni_id,
           scraped_data, discovered_at
    FROM alumni_candidates
    WHERE status = ${tab}
    ORDER BY discovered_at DESC, id DESC
    LIMIT 200
  `) as CandidateRow[];

  return (
    <div className="max-w-[1000px]">
      <div className="mb-4 text-sm">
        <Link href="/admin/tools" className="text-[color:var(--muted)] hover:text-navy">
          ← Tools
        </Link>
      </div>

      <h1 className="font-sans text-4xl font-bold text-[color:var(--navy-ink)] mb-1">
        Discover alumni
      </h1>
      <p className="text-[color:var(--muted)] text-sm mb-6">
        Search the web for UWC alumni in the Bay Area, dedupe against the database,
        and surface new candidates for review. Scrape and add the ones you want.
      </p>

      <DiscoverClient />

      <div className="flex flex-wrap gap-1 mb-4 text-sm font-semibold mt-8 border-b border-[color:var(--rule)]">
        {(["new", "probable_match", "scraped", "added", "rejected"] as const).map((s) => (
          <Link
            key={s}
            href={`/admin/tools/discover?tab=${s}`}
            className={`px-3 py-2 border-b-2 -mb-px ${
              tab === s
                ? "border-navy text-navy"
                : "border-transparent text-[color:var(--muted)] hover:text-navy"
            }`}
          >
            {LABEL[s]}{" "}
            <span className="text-[11px] text-[color:var(--muted)] font-normal">
              ({countByStatus[s] ?? 0})
            </span>
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="bg-white border border-dashed border-[color:var(--rule)] rounded-[10px] p-10 text-center text-sm text-[color:var(--muted)]">
          Nothing in this view.
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((c) => (
            <li key={c.id}>
              <CandidateCard candidate={c} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
