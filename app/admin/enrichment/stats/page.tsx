import Link from "next/link";
import { sql } from "@/lib/db";
import { getEnrichmentCounts } from "@/lib/enrichment/stats";

export const dynamic = "force-dynamic";

export default async function EnrichmentStatsPage() {
  const c = await getEnrichmentCounts();

  // 30-day cohort: where the row was last *touched* by enrichment.
  const recent = (await sql`
    SELECT
      COUNT(*) FILTER (WHERE linkedin_enrichment_status = 'complete')::int AS recent_complete,
      COUNT(*) FILTER (WHERE linkedin_enrichment_status = 'pending')::int  AS recent_pending,
      COUNT(*) FILTER (WHERE linkedin_enrichment_status = 'needs_review')::int AS recent_review,
      COUNT(*) FILTER (WHERE linkedin_enrichment_status = 'failed')::int   AS recent_failed,
      COUNT(*) FILTER (
        WHERE linkedin_enrichment_status = 'complete'
          AND linkedin_url IS NOT NULL
      )::int AS with_url_complete,
      COUNT(*) FILTER (
        WHERE linkedin_enrichment_status = 'complete'
          AND linkedin_url IS NULL
      )::int AS without_url_complete
    FROM alumni
    WHERE linkedin_enriched_at > NOW() - INTERVAL '30 days'
      AND deceased IS NOT TRUE
  `) as {
    recent_complete: number;
    recent_pending: number;
    recent_review: number;
    recent_failed: number;
    with_url_complete: number;
    without_url_complete: number;
  }[];
  const r = recent[0];

  // Estimated cost: rough per-record averages. With URL → just Apify
  // (~$0.03). Without URL → Serper + Exa + Claude + Apify (~$0.08).
  const COST_WITH_URL = 0.03;
  const COST_WITHOUT_URL = 0.08;
  const estCost30d =
    r.with_url_complete * COST_WITH_URL +
    r.without_url_complete * COST_WITHOUT_URL;

  return (
    <div className="max-w-[900px]">
      <div className="mb-4 text-sm">
        <Link href="/admin/enrichment" className="text-[color:var(--muted)] hover:text-navy">
          ← Enrichment
        </Link>
      </div>
      <h1 className="font-sans text-4xl font-bold text-[color:var(--navy-ink)] mb-1">
        Stats & analytics
      </h1>
      <p className="text-[color:var(--muted)] text-sm mb-6">
        Lifecycle counts and rough cost estimates.
      </p>

      <section className="grid sm:grid-cols-4 gap-3 mb-3">
        <Stat label="Total alumni" value={c.total} />
        <Stat label="Attempted ever" value={c.attempted} />
        <Stat label="Currently enriched" value={c.complete} accent="green" />
        <Stat
          label="Success rate"
          value={c.successRate == null ? "—" : `${Math.round(c.successRate * 100)}%`}
          subtitle={c.attempted > 0 ? `${c.complete} / ${c.attempted}` : "no attempts yet"}
        />
      </section>

      <section className="grid sm:grid-cols-4 gap-3 mb-6">
        <Stat label="Pending" value={c.pending} accent={c.pending > 0 ? "yellow" : undefined} />
        <Stat label="Needs review" value={c.needsReview} accent={c.needsReview > 0 ? "orange" : undefined} />
        <Stat label="Failed" value={c.failed} subtitle={`${c.failedApi} API · ${c.failedAdminRejected} rejected`} />
        <Stat label="Never attempted" value={c.never} />
      </section>

      <section className="bg-white border border-[color:var(--rule)] rounded-[10px] p-5 mb-4">
        <h2 className="text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-3">
          Last 30 days
        </h2>
        <dl className="text-sm space-y-1">
          <Row label="Completed" value={r.recent_complete} />
          <Row label="Pending" value={r.recent_pending} />
          <Row label="Needs review" value={r.recent_review} />
          <Row label="Failed" value={r.recent_failed} />
        </dl>
      </section>

      <section className="bg-white border border-[color:var(--rule)] rounded-[10px] p-5 mb-4">
        <h2 className="text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-3">
          Success by scenario
        </h2>
        <dl className="text-sm space-y-1">
          <Row
            label="Scenario A (URL provided)"
            value={r.with_url_complete}
            sub="completed in last 30d — direct Apify scrape"
          />
          <Row
            label="Scenario B (search → match → scrape)"
            value={r.without_url_complete}
            sub="completed in last 30d — Serper + Exa + Claude + Apify"
          />
        </dl>
      </section>

      <section className="bg-white border border-[color:var(--rule)] rounded-[10px] p-5">
        <h2 className="text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-2">
          Estimated 30-day cost
        </h2>
        <div className="text-3xl font-sans font-bold text-navy">
          ${estCost30d.toFixed(2)}
        </div>
        <p className="text-xs text-[color:var(--muted)] mt-2">
          Estimated, not metered. Assumes typical{" "}
          <strong>${COST_WITH_URL.toFixed(2)}/record</strong> for direct scrapes (Scenario A,
          1× Apify) and{" "}
          <strong>${COST_WITHOUT_URL.toFixed(2)}/record</strong> for searched scrapes
          (Scenario B: ~15 Serper + 3 Exa + 1 Claude + 1 Apify). Real bills will vary —
          check the Apify, Serper, and Exa dashboards for ground truth.
        </p>
      </section>

      {c.manualOverrides > 0 && (
        <p className="mt-6 text-xs text-[color:var(--muted)]">
          {c.manualOverrides} of the {c.complete} enriched rows were manual admin overrides
          rather than scraped. They count toward "Currently enriched" but are tagged
          source=manual_override in linkedin_raw_data.
        </p>
      )}
    </div>
  );
}

function Stat({
  label, value, subtitle, accent,
}: {
  label: string;
  value: number | string;
  subtitle?: string;
  accent?: "green" | "yellow" | "orange";
}) {
  const cls =
    accent === "green"
      ? "border-green-300"
      : accent === "yellow"
        ? "border-yellow-300"
        : accent === "orange"
          ? "border-orange-300"
          : "border-[color:var(--rule)]";
  return (
    <div className={`bg-white border ${cls} rounded-[10px] p-4`}>
      <div className="text-[11px] tracking-[.22em] uppercase font-bold text-[color:var(--muted)]">
        {label}
      </div>
      <div className="text-2xl font-sans font-bold text-[color:var(--navy-ink)] mt-1">
        {value}
      </div>
      {subtitle && (
        <div className="text-[10px] text-[color:var(--muted)] mt-1 break-words">{subtitle}</div>
      )}
    </div>
  );
}

function Row({
  label, value, sub,
}: {
  label: string;
  value: number;
  sub?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span>
        <span className="text-[color:var(--navy-ink)]">{label}</span>
        {sub && <span className="text-[color:var(--muted)] text-xs ml-2">{sub}</span>}
      </span>
      <span className="font-sans font-bold tabular-nums">{value.toLocaleString()}</span>
    </div>
  );
}
