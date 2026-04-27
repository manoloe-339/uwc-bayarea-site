import Link from "next/link";
import { sql } from "@/lib/db";
import { fmtDateTime } from "@/lib/admin-time";
import EmailTabs from "@/components/admin/EmailTabs";

export const dynamic = "force-dynamic";

type View = "campaigns" | "other";

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

type OtherEmailRow = {
  id: string;
  kind: string | null;
  email: string;
  subject: string;
  status: string | null;
  sent_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  bounced_at: string | null;
  event_attendee_id: number | null;
  alumni_id: number | null;
  event_slug: string | null;
  event_name: string | null;
  first_name: string | null;
  last_name: string | null;
};

const STATUS_META: Record<string, { label: string; bg: string; fg: string }> = {
  draft:      { label: "Draft",     bg: "#E7DFC8", fg: "#5a6477" },
  scheduled:  { label: "Scheduled", bg: "#DBE7F3", fg: "#01488A" },
  sending:    { label: "Sending…",  bg: "#FEF3C7", fg: "#92400E" },
  sent:       { label: "Sent",      bg: "#D1FAE5", fg: "#065F46" },
  failed:     { label: "Failed",    bg: "#FEE2E2", fg: "#991B1B" },
  cancelled:  { label: "Cancelled", bg: "#F3F4F6", fg: "#6B7280" },
};

const KIND_META: Record<string, { label: string; bg: string; fg: string }> = {
  signup_invite:  { label: "Signup invite",  bg: "#DBE7F3", fg: "#01488A" },
  event_reminder: { label: "Event reminder", bg: "#E0F2E9", fg: "#065F46" },
};

const fmtDate = fmtDateTime;

export default async function CampaignsListPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; format?: string; mode?: string; view?: string; kind?: string }>;
}) {
  const sp = await searchParams;
  const view: View = sp.view === "other" ? "other" : "campaigns";

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="font-sans text-4xl font-bold text-[color:var(--navy-ink)]">Emails</h1>
          <p className="text-[color:var(--muted)] text-sm">
            {view === "other"
              ? "Signup invites and event reminders — sent ad-hoc, not part of a campaign."
              : "Email drafts, scheduled sends, and past campaigns."}
          </p>
        </div>
        {view === "campaigns" && (
          <div className="flex items-center gap-3">
            <Link
              href="/admin/email/quick-send"
              className="text-sm font-semibold text-navy border border-navy px-4 py-2 rounded hover:bg-navy hover:text-white"
            >
              Quick send
            </Link>
            <Link
              href="/admin/email/campaigns/new"
              className="bg-navy text-white px-5 py-2.5 rounded text-sm font-semibold tracking-wide"
            >
              New campaign →
            </Link>
          </div>
        )}
      </div>

      <EmailTabs active={view === "other" ? "other" : "campaigns"} />

      {view === "campaigns" ? <CampaignsTable sp={sp} /> : <OtherEmailsTable sp={sp} />}
    </div>
  );
}

async function CampaignsTable({ sp }: { sp: { status?: string; format?: string } }) {
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
    <>
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
          basePath="/admin/email/campaigns"
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
          basePath="/admin/email/campaigns"
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
    </>
  );
}

async function OtherEmailsTable({ sp }: { sp: { kind?: string } }) {
  const kindFilter = sp.kind && sp.kind !== "all" ? sp.kind : null;

  const rows = (await sql`
    SELECT
      s.id, s.kind, s.email, s.subject, s.status,
      s.sent_at, s.opened_at, s.clicked_at, s.bounced_at,
      s.event_attendee_id, s.alumni_id,
      e.slug AS event_slug, e.name AS event_name,
      a.first_name, a.last_name
    FROM email_sends s
    LEFT JOIN event_attendees ea ON ea.id = s.event_attendee_id
    LEFT JOIN events e ON e.id = ea.event_id
    LEFT JOIN alumni a ON a.id = COALESCE(s.alumni_id, ea.alumni_id)
    WHERE s.campaign_id IS NULL
      AND (${kindFilter}::text IS NULL OR s.kind = ${kindFilter})
    ORDER BY s.sent_at DESC NULLS LAST, s.id DESC
    LIMIT 200
  `) as OtherEmailRow[];

  return (
    <>
      <div className="flex flex-wrap items-end gap-4 bg-white border border-[color:var(--rule)] rounded-[10px] p-4 mb-5">
        <FilterLinks
          label="Kind"
          param="kind"
          current={sp.kind ?? "all"}
          options={[
            { value: "all", label: "All" },
            { value: "signup_invite", label: "Signup invites" },
            { value: "event_reminder", label: "Event reminders" },
          ]}
          basePath="/admin/email/campaigns?view=other"
        />
      </div>

      {rows.length === 0 ? (
        <div className="bg-white border border-[color:var(--rule)] rounded-[10px] p-12 text-center">
          <h2 className="font-sans text-xl font-bold text-[color:var(--navy-ink)] mb-2">
            Nothing here yet
          </h2>
          <p className="text-sm text-[color:var(--muted)]">
            Signup invites and event reminders will appear here as they go out.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-[color:var(--rule)] rounded-[10px] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-ivory-2 text-[11px] tracking-[.18em] uppercase font-bold text-[color:var(--muted)]">
              <tr>
                <th className="text-left px-4 py-2.5">Kind</th>
                <th className="text-left px-4 py-2.5">Recipient</th>
                <th className="text-left px-4 py-2.5">Subject</th>
                <th className="text-left px-4 py-2.5">Event</th>
                <th className="text-left px-4 py-2.5">Status</th>
                <th className="text-left px-4 py-2.5">Sent</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const kindMeta = KIND_META[r.kind ?? ""] ?? {
                  label: r.kind ?? "—",
                  bg: "#F3F4F6",
                  fg: "#374151",
                };
                const fullName = [r.first_name, r.last_name].filter(Boolean).join(" ");
                const status = r.bounced_at
                  ? "bounced"
                  : r.clicked_at
                  ? "clicked"
                  : r.opened_at
                  ? "opened"
                  : r.status === "sent"
                  ? "sent"
                  : r.status ?? "—";
                const statusMeta: { bg: string; fg: string } =
                  status === "clicked"
                    ? { bg: "#D1FAE5", fg: "#065F46" }
                    : status === "opened"
                    ? { bg: "#DBE7F3", fg: "#01488A" }
                    : status === "bounced"
                    ? { bg: "#FEE2E2", fg: "#991B1B" }
                    : status === "sent"
                    ? { bg: "#F3F4F6", fg: "#374151" }
                    : { bg: "#F3F4F6", fg: "#6B7280" };
                return (
                  <tr key={r.id} className="border-t border-[color:var(--rule)] hover:bg-ivory">
                    <td className="px-4 py-2.5">
                      <span
                        className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-sm"
                        style={{ background: kindMeta.bg, color: kindMeta.fg }}
                      >
                        {kindMeta.label}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="text-[color:var(--navy-ink)]">{fullName || r.email}</div>
                      {fullName && (
                        <div className="text-[11px] text-[color:var(--muted)]">{r.email}</div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-[color:var(--navy-ink)]">
                      {r.subject || <span className="italic text-[color:var(--muted)]">(no subject)</span>}
                    </td>
                    <td className="px-4 py-2.5 text-xs">
                      {r.event_slug ? (
                        <Link
                          href={`/admin/events/${r.event_slug}/attendees`}
                          className="text-navy hover:underline"
                        >
                          {r.event_name}
                        </Link>
                      ) : (
                        <span className="text-[color:var(--muted)]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-sm"
                        style={{ background: statusMeta.bg, color: statusMeta.fg }}
                      >
                        {status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-[color:var(--muted)]">
                      {fmtDate(r.sent_at)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function FilterLinks({
  label, param, current, options, basePath,
}: {
  label: string;
  param: string;
  current: string;
  options: { value: string; label: string }[];
  basePath: string;
}) {
  return (
    <div>
      <div className="text-[11px] tracking-[.22em] uppercase font-bold text-[color:var(--muted)] mb-1">
        {label}
      </div>
      <div className="flex flex-wrap gap-1.5 text-xs">
        {options.map((o) => {
          const active = current === o.value;
          const sep = basePath.includes("?") ? "&" : "?";
          const href = o.value === "all" ? basePath : `${basePath}${sep}${param}=${o.value}`;
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
