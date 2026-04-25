import Link from "next/link";
import { getEnrichmentCounts } from "@/lib/enrichment/stats";

export const dynamic = "force-dynamic";

export default async function EnrichmentLandingPage() {
  const c = await getEnrichmentCounts();
  return (
    <div className="max-w-[800px]">
      <h1 className="font-sans text-4xl font-bold text-[color:var(--navy-ink)] mb-1">
        LinkedIn enrichment
      </h1>
      <p className="text-[color:var(--muted)] text-sm mb-8">
        Backfill alumni profiles with LinkedIn data via Apify, search, and Claude.
      </p>

      <ul className="grid sm:grid-cols-3 gap-3">
        <NavCard
          href="/admin/enrichment/review"
          label="Review queue"
          count={c.needsReview}
          tone={c.needsReview > 0 ? "orange" : "muted"}
          subtitle="Medium-confidence matches awaiting your call"
        />
        <NavCard
          href="/admin/enrichment/failed"
          label="Failed"
          count={c.failed}
          tone={c.failed > 0 ? "red" : "muted"}
          subtitle={`${c.failedApi} API failures · ${c.failedAdminRejected} admin-rejected`}
        />
        <NavCard
          href="/admin/enrichment/stats"
          label="Stats & analytics"
          count={null}
          tone="muted"
          subtitle="Success rates, costs, lifecycle counts"
        />
      </ul>

      <section className="mt-8 grid sm:grid-cols-4 gap-3">
        <Stat label="Enriched" value={c.complete} accent="green" />
        <Stat label="Pending" value={c.pending} accent={c.pending > 0 ? "yellow" : undefined} />
        <Stat label="Never attempted" value={c.never} />
        <Stat
          label="Success rate"
          value={c.successRate == null ? "—" : `${Math.round(c.successRate * 100)}%`}
        />
      </section>

      <p className="mt-8 text-xs text-[color:var(--muted)]">
        Manual triggers, raw-data inspection, and per-record overrides live on each
        individual alumni detail page.
      </p>
    </div>
  );
}

function NavCard({
  href, label, count, subtitle, tone,
}: {
  href: string;
  label: string;
  count: number | null;
  subtitle: string;
  tone: "orange" | "red" | "muted";
}) {
  const border =
    tone === "orange"
      ? "border-orange-300"
      : tone === "red"
        ? "border-red-300"
        : "border-[color:var(--rule)]";
  return (
    <li>
      <Link
        href={href}
        className={`block bg-white border ${border} rounded-[10px] p-4 hover:bg-ivory-2`}
      >
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-[11px] tracking-[.22em] uppercase font-bold text-navy">
            {label}
          </span>
          {count != null && (
            <span className="text-2xl font-sans font-bold text-[color:var(--navy-ink)]">
              {count}
            </span>
          )}
        </div>
        <p className="text-xs text-[color:var(--muted)]">{subtitle}</p>
      </Link>
    </li>
  );
}

function Stat({
  label, value, accent,
}: {
  label: string;
  value: number | string;
  accent?: "green" | "yellow";
}) {
  const cls =
    accent === "green"
      ? "border-green-300"
      : accent === "yellow"
        ? "border-yellow-300"
        : "border-[color:var(--rule)]";
  return (
    <div className={`bg-white border ${cls} rounded-[10px] p-4`}>
      <div className="text-[11px] tracking-[.22em] uppercase font-bold text-[color:var(--muted)]">
        {label}
      </div>
      <div className="text-2xl font-sans font-bold text-[color:var(--navy-ink)] mt-1">
        {value}
      </div>
    </div>
  );
}
