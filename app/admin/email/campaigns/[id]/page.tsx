import Link from "next/link";
import { notFound } from "next/navigation";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

type CampaignRow = {
  id: string;
  subject: string;
  format: string;
  mode: string | null;
  status: string;
  recipient_count: number;
  sent_count: number;
  failed_count: number;
  created_at: string;
  scheduled_for: string | null;
  sent_at: string | null;
};

type SendTallies = {
  sent: number;
  failed: number;
  opened: number;
  clicked: number;
  bounced: number;
  complained: number;
};

function fmt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
  });
}

export default async function CampaignDetailStub({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rows = (await sql`SELECT * FROM email_campaigns WHERE id = ${id}`) as CampaignRow[];
  if (rows.length === 0) notFound();
  const c = rows[0];

  const tallies = (await sql`
    SELECT
      COUNT(*) FILTER (WHERE status = 'sent')::int       AS sent,
      COUNT(*) FILTER (WHERE status = 'failed')::int     AS failed,
      COUNT(*) FILTER (WHERE opened_at IS NOT NULL)::int  AS opened,
      COUNT(*) FILTER (WHERE clicked_at IS NOT NULL)::int AS clicked,
      COUNT(*) FILTER (WHERE bounced_at IS NOT NULL)::int AS bounced,
      COUNT(*) FILTER (WHERE complained_at IS NOT NULL)::int AS complained
    FROM email_sends WHERE campaign_id = ${id}
  `) as SendTallies[];
  const t = tallies[0];

  return (
    <div className="max-w-[900px]">
      <div className="mb-4">
        <Link href="/admin/email/campaigns" className="text-sm text-[color:var(--muted)] hover:text-navy">
          ← Campaigns
        </Link>
      </div>
      <h1 className="font-sans text-3xl font-bold text-[color:var(--navy-ink)] mb-1">
        {c.subject || "(untitled)"}
      </h1>
      <p className="text-[color:var(--muted)] text-sm mb-6">
        {c.format === "newsletter" ? "Newsletter" : "Quick note"}
        {c.mode ? ` · ${c.mode}` : ""}
        {" · "}Status: <strong>{c.status}</strong>
        {" · "}Recipients: {c.recipient_count}
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <Tile label="Sent" value={t.sent} />
        <Tile label="Opened" value={t.opened} />
        <Tile label="Clicked" value={t.clicked} />
        <Tile label="Bounced" value={t.bounced} tone={t.bounced ? "warn" : "normal"} />
      </div>

      {t.complained > 0 && (
        <div className="mb-6 p-4 border-l-4 border-red-600 bg-red-50 text-sm text-red-900 rounded-[2px]">
          ⚠️ {t.complained} spam complaint{t.complained === 1 ? "" : "s"} on this campaign. These
          alumni have been auto-unsubscribed and admin has been notified.
        </div>
      )}

      <div className="bg-white border border-[color:var(--rule)] rounded-[10px] p-5 mb-6 text-sm">
        <dl className="grid gap-2 sm:grid-cols-2">
          <Row label="Created" value={fmt(c.created_at)} />
          <Row label="Scheduled for" value={fmt(c.scheduled_for)} />
          <Row label="Sent at" value={fmt(c.sent_at)} />
          <Row label="Delivered / Failed" value={`${t.sent - t.bounced} / ${t.failed}`} />
        </dl>
      </div>

      <div className="flex gap-3">
        {(c.status === "draft" || c.status === "scheduled") && (
          <Link
            href={`/admin/email/campaigns/${c.id}/edit`}
            className="text-sm font-semibold text-white bg-navy px-4 py-2 rounded"
          >
            Edit →
          </Link>
        )}
        <p className="text-xs text-[color:var(--muted)] self-center">
          Full detail view — duplicate, retry, per-recipient list — lands in the next build step.
        </p>
      </div>
    </div>
  );
}

function Tile({ label, value, tone = "normal" }: { label: string; value: number; tone?: "normal" | "warn" }) {
  return (
    <div className="bg-white border border-[color:var(--rule)] rounded-[10px] p-4">
      <div className="text-[11px] tracking-[.22em] uppercase font-bold text-[color:var(--muted)]">{label}</div>
      <div
        className={`mt-1 text-2xl font-sans font-bold ${tone === "warn" ? "text-red-700" : "text-[color:var(--navy-ink)]"}`}
      >
        {value.toLocaleString()}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-[11px] uppercase tracking-[.2em] text-[color:var(--muted)]">{label}</dt>
      <dd className="text-[color:var(--navy-ink)]">{value}</dd>
    </>
  );
}
