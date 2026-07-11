import Link from "next/link";
import { notFound } from "next/navigation";
import { sql } from "@/lib/db";
import {
  renderSimpleMarkdown,
  EMAIL_LINK_ATTRS,
  EMAIL_PARAGRAPH_ATTRS,
} from "@/lib/simple-markdown";

export const dynamic = "force-dynamic";

type SendRow = {
  id: string;
  kind: string | null;
  email: string;
  subject: string | null;
  body: string | null;
  status: string;
  error: string | null;
  resend_message_id: string | null;
  sent_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  bounced_at: string | null;
  created_at: string;
  alumni_id: number | null;
  first_name: string | null;
  last_name: string | null;
  event_attendee_id: number | null;
  event_slug: string | null;
  event_name: string | null;
};

// The `body` column stores whichever text form was passed to sendTestEmail
// — for markdown-based kinds (signup_confirmation, signup_invite, ...)
// that's the RESOLVED markdown (placeholders already substituted), so we
// render it here through the same simple-markdown pipeline used at send
// time so the admin sees the same paragraph/link formatting the recipient
// got. For any kind whose body isn't markdown (raw text, admin
// notifications) the renderer still produces sane paragraph tags.
export default async function EmailSendDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const rows = (await sql`
    SELECT
      s.id, s.kind, s.email, s.subject, s.body, s.status, s.error,
      s.resend_message_id,
      s.sent_at, s.opened_at, s.clicked_at, s.bounced_at, s.created_at,
      s.alumni_id, a.first_name, a.last_name,
      s.event_attendee_id, e.slug AS event_slug, e.name AS event_name
    FROM email_sends s
    LEFT JOIN alumni a ON a.id = COALESCE(s.alumni_id,
      (SELECT ea.alumni_id FROM event_attendees ea WHERE ea.id = s.event_attendee_id)
    )
    LEFT JOIN event_attendees ea ON ea.id = s.event_attendee_id
    LEFT JOIN events e ON e.id = ea.event_id
    WHERE s.id = ${id}
    LIMIT 1
  `) as SendRow[];

  const r = rows[0];
  if (!r) notFound();

  const fullName = [r.first_name, r.last_name].filter(Boolean).join(" ");
  const bodyHtml = r.body
    ? renderSimpleMarkdown(r.body, EMAIL_LINK_ATTRS, EMAIL_PARAGRAPH_ATTRS)
    : "";

  return (
    <main className="max-w-[900px] mx-auto p-6">
      <div className="mb-4 text-sm">
        <Link
          href="/admin/email/campaigns?view=other"
          className="text-navy hover:underline"
        >
          ← Back to emails
        </Link>
      </div>

      <div className="bg-white border border-[color:var(--rule)] rounded-[10px] p-6 mb-6">
        <div className="mb-4">
          <div className="text-[10px] uppercase tracking-wider font-bold text-[color:var(--muted)] mb-1">
            {r.kind ?? "email"}
          </div>
          <h1 className="text-xl font-bold text-[color:var(--navy-ink)] leading-tight">
            {r.subject || <span className="italic text-[color:var(--muted)]">(no subject)</span>}
          </h1>
        </div>

        <dl className="grid grid-cols-[120px_1fr] gap-x-4 gap-y-2 text-sm mb-4">
          <dt className="text-[color:var(--muted)]">To</dt>
          <dd className="text-[color:var(--navy-ink)]">
            {r.alumni_id ? (
              <Link
                href={`/admin/alumni/${r.alumni_id}`}
                className="hover:underline"
              >
                {fullName || r.email}
              </Link>
            ) : (
              <span>{fullName || r.email}</span>
            )}
            {fullName && (
              <span className="text-[color:var(--muted)]"> · {r.email}</span>
            )}
          </dd>

          <dt className="text-[color:var(--muted)]">Status</dt>
          <dd>
            <StatusBadge row={r} />
            {r.error && (
              <span className="ml-2 text-xs text-red-700">{r.error}</span>
            )}
          </dd>

          <dt className="text-[color:var(--muted)]">Sent</dt>
          <dd className="text-[color:var(--navy-ink)]">
            {fmt(r.sent_at) ?? <span className="text-[color:var(--muted)]">not yet</span>}
          </dd>

          {r.opened_at && (
            <>
              <dt className="text-[color:var(--muted)]">Opened</dt>
              <dd className="text-[color:var(--navy-ink)]">{fmt(r.opened_at)}</dd>
            </>
          )}
          {r.clicked_at && (
            <>
              <dt className="text-[color:var(--muted)]">Clicked</dt>
              <dd className="text-[color:var(--navy-ink)]">{fmt(r.clicked_at)}</dd>
            </>
          )}
          {r.bounced_at && (
            <>
              <dt className="text-[color:var(--muted)]">Bounced</dt>
              <dd className="text-[color:var(--navy-ink)]">{fmt(r.bounced_at)}</dd>
            </>
          )}

          {r.event_slug && (
            <>
              <dt className="text-[color:var(--muted)]">Event</dt>
              <dd>
                <Link
                  href={`/admin/events/${r.event_slug}/attendees`}
                  className="text-navy hover:underline"
                >
                  {r.event_name}
                </Link>
              </dd>
            </>
          )}

          {r.resend_message_id && (
            <>
              <dt className="text-[color:var(--muted)]">Resend id</dt>
              <dd className="text-xs text-[color:var(--muted)] font-mono">
                {r.resend_message_id}
              </dd>
            </>
          )}
        </dl>
      </div>

      <div className="mb-4 text-[11px] uppercase tracking-[.22em] font-bold text-[color:var(--muted)]">
        Message body (rendered)
      </div>
      <div className="bg-white border border-[color:var(--rule)] rounded-[10px] p-6 mb-6">
        {r.body ? (
          <div
            className="prose prose-sm max-w-none text-[color:var(--navy-ink)] leading-relaxed [&_a]:text-navy [&_a]:underline"
            dangerouslySetInnerHTML={{ __html: bodyHtml }}
          />
        ) : (
          <p className="text-sm italic text-[color:var(--muted)]">
            No body was logged for this send.
          </p>
        )}
      </div>

      {r.body && (
        <details>
          <summary className="text-xs text-[color:var(--muted)] cursor-pointer hover:text-navy">
            Show raw markdown source
          </summary>
          <pre className="mt-3 bg-ivory-2 border border-[color:var(--rule)] rounded p-4 text-xs whitespace-pre-wrap font-mono text-[color:var(--navy-ink)]">
            {r.body}
          </pre>
        </details>
      )}
    </main>
  );
}

function StatusBadge({ row }: { row: SendRow }) {
  const status = row.bounced_at
    ? "bounced"
    : row.clicked_at
    ? "clicked"
    : row.opened_at
    ? "opened"
    : row.status === "sent"
    ? "sent"
    : row.status ?? "—";
  const style: { bg: string; fg: string } =
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
    <span
      className="inline-block text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-sm"
      style={{ background: style.bg, color: style.fg }}
    >
      {status}
    </span>
  );
}

function fmt(ts: string | null): string | null {
  if (!ts) return null;
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Los_Angeles",
  });
}
