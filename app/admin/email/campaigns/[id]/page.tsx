import Link from "next/link";
import { notFound } from "next/navigation";
import { sql } from "@/lib/db";
import { fmtDateTime, fmtDateTimeShort } from "@/lib/admin-time";

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

type SendListRow = {
  id: string;
  alumni_id: number | null;
  email: string;
  status: string;
  error: string | null;
  sent_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  bounced_at: string | null;
  complained_at: string | null;
  first_name: string | null;
  last_name: string | null;
};

const fmt = fmtDateTime;
const fmtShort = fmtDateTimeShort;

export default async function CampaignDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rows = (await sql`SELECT * FROM email_campaigns WHERE id = ${id}`) as CampaignRow[];
  if (rows.length === 0) notFound();
  const c = rows[0];

  const tallies = (await sql`
    SELECT
      COUNT(*) FILTER (WHERE status = 'sent' AND is_test IS NOT TRUE)::int       AS sent,
      COUNT(*) FILTER (WHERE status = 'failed' AND is_test IS NOT TRUE)::int     AS failed,
      COUNT(*) FILTER (WHERE opened_at IS NOT NULL AND is_test IS NOT TRUE)::int  AS opened,
      COUNT(*) FILTER (WHERE clicked_at IS NOT NULL AND is_test IS NOT TRUE)::int AS clicked,
      COUNT(*) FILTER (WHERE bounced_at IS NOT NULL AND is_test IS NOT TRUE)::int AS bounced,
      COUNT(*) FILTER (WHERE complained_at IS NOT NULL AND is_test IS NOT TRUE)::int AS complained
    FROM email_sends WHERE campaign_id = ${id}
  `) as SendTallies[];
  const t = tallies[0];

  const sendList = (await sql`
    SELECT
      s.id, s.alumni_id, s.email, s.status, s.error,
      s.sent_at, s.opened_at, s.clicked_at, s.bounced_at, s.complained_at,
      a.first_name, a.last_name
    FROM email_sends s
    LEFT JOIN alumni a ON a.id = s.alumni_id
    WHERE s.campaign_id = ${id} AND (s.is_test IS NOT TRUE)
    ORDER BY
      CASE s.status WHEN 'failed' THEN 0 WHEN 'sent' THEN 1 ELSE 2 END,
      s.sent_at DESC NULLS LAST,
      s.email
  `) as SendListRow[];

  return (
    <div className="max-w-[1100px]">
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

      {/* Per-recipient list */}
      <section className="bg-white border border-[color:var(--rule)] rounded-[10px] overflow-hidden mb-6">
        <div className="px-5 py-3 border-b border-[color:var(--rule)] flex items-baseline justify-between">
          <h2 className="text-[11px] tracking-[.22em] uppercase font-bold text-navy">
            Recipients ({sendList.length})
          </h2>
          <span className="text-xs text-[color:var(--muted)]">
            Failed rows sorted first.
          </span>
        </div>
        {sendList.length === 0 ? (
          <p className="p-5 text-sm text-[color:var(--muted)]">No send rows recorded.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-ivory-2 text-[11px] tracking-[.18em] uppercase font-bold text-[color:var(--muted)]">
              <tr>
                <Th>Name</Th>
                <Th>Email</Th>
                <Th>Status</Th>
                <Th>Sent</Th>
                <Th>Opened</Th>
                <Th>Clicked</Th>
              </tr>
            </thead>
            <tbody>
              {sendList.map((r) => {
                const name =
                  [r.first_name, r.last_name].filter(Boolean).join(" ") || "—";
                const isComplaint = !!r.complained_at;
                const isBounce = !!r.bounced_at;
                const statusBadge = isComplaint
                  ? { label: "complained", tone: "red" }
                  : isBounce
                  ? { label: "bounced", tone: "orange" }
                  : r.status === "sent"
                  ? { label: "sent", tone: "green" }
                  : r.status === "failed"
                  ? { label: "failed", tone: "red" }
                  : { label: r.status, tone: "gray" };
                return (
                  <tr key={r.id} className="border-t border-[color:var(--rule)] hover:bg-ivory">
                    <Td>
                      {r.alumni_id != null ? (
                        <Link
                          href={`/admin/alumni/${r.alumni_id}`}
                          className="text-navy hover:underline font-semibold"
                        >
                          {name}
                        </Link>
                      ) : (
                        <span className="text-[color:var(--muted)]">{name}</span>
                      )}
                    </Td>
                    <Td>
                      <span className="text-[color:var(--muted)]">{r.email}</span>
                    </Td>
                    <Td>
                      <Badge tone={statusBadge.tone}>{statusBadge.label}</Badge>
                      {r.error && (
                        <span className="block text-[10px] text-red-700 mt-0.5" title={r.error}>
                          {r.error.length > 40 ? r.error.slice(0, 40) + "…" : r.error}
                        </span>
                      )}
                    </Td>
                    <Td>{fmtShort(r.sent_at)}</Td>
                    <Td>{fmtShort(r.opened_at)}</Td>
                    <Td>{fmtShort(r.clicked_at)}</Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <div className="flex gap-3">
        {(c.status === "draft" || c.status === "scheduled") && (
          <Link
            href={`/admin/email/campaigns/${c.id}/edit`}
            className="text-sm font-semibold text-white bg-navy px-4 py-2 rounded"
          >
            Edit →
          </Link>
        )}
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

function Th({ children }: { children: React.ReactNode }) {
  return <th className="text-left px-4 py-2.5">{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-2.5 align-top">{children}</td>;
}

function Badge({ tone, children }: { tone: string; children: React.ReactNode }) {
  const map: Record<string, string> = {
    green: "bg-green-50 text-green-800 border-green-200",
    red: "bg-red-50 text-red-800 border-red-200",
    orange: "bg-orange-50 text-orange-800 border-orange-200",
    gray: "bg-ivory-2 text-[color:var(--navy-ink)] border-[color:var(--rule)]",
  };
  return (
    <span
      className={`inline-block text-[10px] uppercase tracking-[.12em] font-bold border rounded-full px-2 py-0.5 ${map[tone] ?? map.gray}`}
    >
      {children}
    </span>
  );
}
