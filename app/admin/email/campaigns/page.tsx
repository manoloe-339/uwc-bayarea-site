import Link from "next/link";
import { sql } from "@/lib/db";
import { fmtDateTime } from "@/lib/admin-time";

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
  opened: number;
  clicked: number;
};

const STATUS_META: Record<string, { label: string; bg: string; fg: string }> = {
  draft:      { label: "Draft",     bg: "#E7DFC8", fg: "#5a6477" },
  scheduled:  { label: "Scheduled", bg: "#DBE7F3", fg: "#01488A" },
  sending:    { label: "Sending…",  bg: "#FEF3C7", fg: "#92400E" },
  sent:       { label: "Sent",      bg: "#D1FAE5", fg: "#065F46" },
  failed:     { label: "Failed",    bg: "#FEE2E2", fg: "#991B1B" },
  cancelled:  { label: "Cancelled", bg: "#F3F4F6", fg: "#6B7280" },
};

const fmtDate = fmtDateTime;

export default async function CampaignsListPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; format?: string; mode?: string }>;
}) {
  const sp = await searchParams;
  const statusFilter = sp.status && sp.status !== "all" ? sp.status : null;
  const formatFilter = sp.format && sp.format !== "all" ? sp.format : null;

  const rows = (await sql`
    SELECT
      c.id, c.subject, c.format, c.mode, c.status,
      c.recipient_count, c.sent_count, c.failed_count,
      c.created_at, c.scheduled_for, c.sent_at,
      COUNT(*) FILTER (WHERE s.opened_at IS NOT NULL)::int AS opened,
      COUNT(*) FILTER (WHERE s.clicked_at IS NOT NULL)::int AS clicked
    FROM email_campaigns c
    LEFT JOIN email_sends s ON s.campaign_id = c.id
    WHERE (${statusFilter}::text IS NULL OR c.status = ${statusFilter})
      AND (${formatFilter}::text IS NULL OR c.format = ${formatFilter})
    GROUP BY c.id
    ORDER BY c.created_at DESC
    LIMIT 200
  `) as CampaignRow[];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-sans text-4xl font-bold text-[color:var(--navy-ink)]">Campaigns</h1>
          <p className="text-[color:var(--muted)] text-sm">
            Email drafts, scheduled sends, and past campaigns.
          </p>
        </div>
        <Link
          href="/admin/email/campaigns/new"
          className="bg-navy text-white px-5 py-2.5 rounded text-sm font-semibold tracking-wide"
        >
          New campaign →
        </Link>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-end gap-4 bg-white border border-[color:var(--rule)] rounded-[10px] p-4 mb-5">
        <FilterLinks
          label="Status"
          param="status"
          current={sp.status ?? "all"}
          options={[
            { value: "all", label: "All" },
            { value: "draft", label: "Drafts" },
            { value: "scheduled", label: "Scheduled" },
            { value: "sent", label: "Sent" },
            { value: "failed", label: "Failed" },
            { value: "cancelled", label: "Cancelled" },
          ]}
        />
        <FilterLinks
          label="Format"
          param="format"
          current={sp.format ?? "all"}
          options={[
            { value: "all", label: "All" },
            { value: "quick_note", label: "Quick note" },
            { value: "newsletter", label: "Newsletter" },
          ]}
        />
      </div>

      {rows.length === 0 ? (
        <div className="bg-white border border-[color:var(--rule)] rounded-[10px] p-12 text-center">
          <h2 className="font-sans text-xl font-bold text-[color:var(--navy-ink)] mb-2">
            No campaigns {statusFilter || formatFilter ? "match these filters" : "yet"}
          </h2>
          <p className="text-sm text-[color:var(--muted)] mb-5">
            {statusFilter || formatFilter
              ? "Clear the filters or start a new draft."
              : "Drafts, scheduled sends, and past campaigns will appear here."}
          </p>
          <Link
            href="/admin/email/campaigns/new"
            className="inline-block bg-navy text-white px-5 py-2.5 rounded text-sm font-semibold"
          >
            Create your first campaign
          </Link>
        </div>
      ) : (
        <div className="bg-white border border-[color:var(--rule)] rounded-[10px] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-ivory-2 text-[11px] tracking-[.18em] uppercase font-bold text-[color:var(--muted)]">
              <tr>
                <th className="text-left px-4 py-2.5">Subject</th>
                <th className="text-left px-4 py-2.5">Format</th>
                <th className="text-left px-4 py-2.5">Status</th>
                <th className="text-left px-4 py-2.5">Recipients</th>
                <th className="text-left px-4 py-2.5">Stats</th>
                <th className="text-left px-4 py-2.5">When</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const meta = STATUS_META[c.status] ?? STATUS_META.draft;
                const whenLabel =
                  c.status === "scheduled"
                    ? `Scheduled ${fmtDate(c.scheduled_for)}`
                    : c.status === "sent"
                      ? `Sent ${fmtDate(c.sent_at)}`
                      : `Created ${fmtDate(c.created_at)}`;
                const stats =
                  c.status === "sent"
                    ? `${c.sent_count} sent · ${c.opened} opened · ${c.clicked} clicked`
                    : c.status === "failed"
                      ? `${c.failed_count} failed`
                      : c.status === "draft"
                        ? "—"
                        : "—";
                return (
                  <tr key={c.id} className="border-t border-[color:var(--rule)] hover:bg-ivory">
                    <td className="px-4 py-2.5">
                      <Link
                        href={
                          c.status === "draft" || c.status === "scheduled"
                            ? `/admin/email/campaigns/${c.id}/edit`
                            : `/admin/email/campaigns/${c.id}`
                        }
                        className="font-semibold text-navy hover:underline"
                      >
                        {c.subject || <span className="italic text-[color:var(--muted)]">(untitled)</span>}
                      </Link>
                      {c.mode && (
                        <span className="ml-2 text-[10px] text-[color:var(--muted)] uppercase tracking-wider">
                          {c.mode}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-[10px] uppercase tracking-wider text-[color:var(--muted)]">
                        {c.format === "newsletter" ? "Newsletter" : "Quick note"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-sm"
                        style={{ background: meta.bg, color: meta.fg }}
                      >
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">{c.recipient_count.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-xs text-[color:var(--muted)]">{stats}</td>
                    <td className="px-4 py-2.5 text-xs text-[color:var(--muted)]">{whenLabel}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FilterLinks({
  label, param, current, options,
}: {
  label: string;
  param: string;
  current: string;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <div className="text-[11px] tracking-[.22em] uppercase font-bold text-[color:var(--muted)] mb-1">
        {label}
      </div>
      <div className="flex flex-wrap gap-1.5 text-xs">
        {options.map((o) => {
          const active = current === o.value;
          const href = o.value === "all"
            ? (param === "status" ? "/admin/email/campaigns" : `/admin/email/campaigns?status=${current}`)
            : `/admin/email/campaigns?${param}=${o.value}`;
          return (
            <Link
              key={o.value}
              href={href}
              className={`px-2.5 py-1 rounded border ${
                active
                  ? "bg-navy text-white border-navy"
                  : "border-[color:var(--rule)] text-[color:var(--navy-ink)] hover:border-navy"
              }`}
            >
              {o.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
