import Link from "next/link";
import { notFound } from "next/navigation";
import { sql } from "@/lib/db";
import { getEventBySlug, getCommunicationStats } from "@/lib/events-db";
import { CommunicationsControls } from "@/components/admin/CommunicationsControls";
import { ReminderCopyEditor } from "@/components/admin/ReminderCopyEditor";
import { ReminderScheduleEditor } from "@/components/admin/ReminderScheduleEditor";
import {
  DEFAULT_REMINDER_SUBJECT,
  DEFAULT_REMINDER_HEADING,
  DEFAULT_REMINDER_BODY,
} from "@/lib/attendee-reminder";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function fmtDateTime(s: string | null): string {
  if (!s) return "—";
  return new Date(s).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function CommunicationsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const event = await getEventBySlug(slug);
  if (!event) notFound();
  const stats = await getCommunicationStats(event.id);
  const missingQr = stats.totalEligible - stats.qrGenerated;
  const unsentCount = stats.totalEligible - stats.remindersSent;

  // Name-tag finalization status — surfaced so the admin sees how many
  // tags will appear in the QR email as confirmed vs still under review.
  const tagCountsRows = (await sql`
    SELECT status, COUNT(*)::int AS n
    FROM event_name_tags
    WHERE event_id = ${event.id}
    GROUP BY status
  `) as { status: "pending" | "fix" | "finalized"; n: number }[];
  const tagCounts = {
    finalized: 0,
    pending: 0,
    fix: 0,
    total: 0,
  };
  for (const r of tagCountsRows) {
    tagCounts[r.status] = r.n;
    tagCounts.total += r.n;
  }
  const tagsMissing = Math.max(0, stats.totalEligible - tagCounts.total);

  // Recent reminder sends — simple log table at the bottom.
  const recent = (await sql`
    SELECT
      s.id, s.subject, s.sent_at, s.status, s.opened_at, s.clicked_at, s.email,
      a.id AS attendee_id,
      COALESCE(NULLIF(TRIM(CONCAT_WS(' ', al.first_name, al.last_name)), ''),
               NULLIF(a.stripe_customer_name, '')) AS display_name
    FROM email_sends s
    JOIN event_attendees a ON a.id = s.event_attendee_id
    LEFT JOIN alumni al ON al.id = a.alumni_id
    WHERE s.kind = 'event_reminder' AND a.event_id = ${event.id}
    ORDER BY s.sent_at DESC NULLS LAST
    LIMIT 50
  `) as {
    id: string;
    subject: string;
    sent_at: string | null;
    status: string | null;
    opened_at: string | null;
    clicked_at: string | null;
    email: string | null;
    attendee_id: number;
    display_name: string | null;
  }[];

  return (
    <div className="max-w-[1000px]">
      <div className="mb-4 text-sm">
        <Link
          href={`/admin/events/${slug}/attendees`}
          className="text-[color:var(--muted)] hover:text-navy"
        >
          ← {event.name}
        </Link>
      </div>

      <div className="flex items-end justify-between mb-2 flex-wrap gap-3">
        <div>
          <h1 className="font-sans text-4xl font-bold text-[color:var(--navy-ink)]">
            Communications
          </h1>
          <p className="text-[color:var(--muted)] text-sm">
            Generate QR codes for check-in and send the day-before reminder.
          </p>
        </div>
        <nav className="flex items-center gap-1 text-sm font-semibold">
          <SubTab href={`/admin/events/${slug}/attendees`}>Attendees</SubTab>
          <SubTab href={`/admin/events/${slug}/communications`} active>Communications</SubTab>
        </nav>
      </div>

      <section className="grid sm:grid-cols-3 gap-3 my-6">
        <Stat label="QR codes generated" value={`${stats.qrGenerated} / ${stats.totalEligible}`} />
        <Stat
          label="Reminders sent"
          value={`${stats.remindersSent} / ${stats.totalEligible}`}
          accent={stats.remindersSent < stats.totalEligible}
        />
        <Stat label="Last reminder sent" value={stats.lastSentAt ? fmtDateTime(stats.lastSentAt) : "Never"} />
      </section>

      <section className="bg-white border border-[color:var(--rule)] rounded-[10px] p-4 mb-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-1">
              Name tag readiness
            </div>
            <p className="text-xs text-[color:var(--muted)] max-w-prose">
              The reminder email shows the exact tag content for{" "}
              <strong className="text-emerald-700">finalized</strong> tags only.
              Pending and Fix tags get a soft prompt asking the recipient to
              confirm. Manage tags on{" "}
              <Link href={`/admin/events/${slug}/name-tags`} className="text-navy underline">
                Name tags →
              </Link>
              .
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap text-[10px] tracking-[.18em] uppercase font-bold">
            <span className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-2 py-1 rounded-full">
              {tagCounts.finalized} finalized
            </span>
            {tagCounts.fix > 0 && (
              <span className="bg-rose-50 border border-rose-200 text-rose-800 px-2 py-1 rounded-full">
                {tagCounts.fix} need fix
              </span>
            )}
            {tagCounts.pending > 0 && (
              <span className="bg-amber-50 border border-amber-200 text-amber-800 px-2 py-1 rounded-full">
                {tagCounts.pending} pending
              </span>
            )}
            {tagsMissing > 0 && (
              <span className="bg-slate-50 border border-slate-200 text-slate-700 px-2 py-1 rounded-full">
                {tagsMissing} no tag yet
              </span>
            )}
          </div>
        </div>
      </section>

      <ReminderScheduleEditor
        slug={slug}
        initialScheduledAt={event.reminder_scheduled_at}
        autoSentAt={event.reminder_auto_sent_at}
        eventDateIso={new Date(event.date).toISOString()}
        eventTime={event.time}
      />

      <ReminderCopyEditor
        slug={slug}
        initialSubject={event.reminder_subject}
        initialHeading={event.reminder_heading}
        initialBody={event.reminder_body}
        defaults={{
          subject: DEFAULT_REMINDER_SUBJECT,
          heading: DEFAULT_REMINDER_HEADING,
          body: DEFAULT_REMINDER_BODY,
        }}
        sampleVars={{
          name: "Alex Doe",
          event: event.name,
          date: new Date(event.date).toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          }),
          time: event.time ?? "",
          location: event.location ?? "",
          locationMapUrl: event.location_map_url ?? null,
          amount: `$${Number(event.ticket_price ?? 0).toFixed(2)}`,
        }}
      />

      <section className="bg-white border border-[color:var(--rule)] rounded-[10px] p-5 mb-6">
        <h2 className="text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-3">
          Actions
        </h2>
        <CommunicationsControls
          slug={slug}
          totalEligible={stats.totalEligible}
          qrGenerated={stats.qrGenerated}
          remindersSent={stats.remindersSent}
          missingQr={missingQr}
          unsentCount={unsentCount}
          matchedWithAlumni={stats.matchedWithAlumni}
          guestsOnStripeEmail={stats.guestsOnStripeEmail}
        />
        {stats.totalEligible === 0 && (
          <p className="text-xs text-[color:var(--muted)] mt-3">
            No paid / comp attendees yet. Sync from Stripe or add a special guest first.
          </p>
        )}
      </section>

      <section className="bg-white border border-[color:var(--rule)] rounded-[10px] overflow-hidden">
        <h2 className="text-[11px] tracking-[.22em] uppercase font-bold text-navy px-5 py-4 border-b border-[color:var(--rule)]">
          Recent reminder sends ({recent.length})
        </h2>
        {recent.length === 0 ? (
          <div className="p-6 text-sm text-[color:var(--muted)] text-center">
            No reminder emails sent yet.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-ivory-2 text-[10px] tracking-[.18em] uppercase font-bold text-[color:var(--muted)]">
              <tr>
                <th className="text-left px-4 py-2">Attendee</th>
                <th className="text-left px-4 py-2">Email</th>
                <th className="text-left px-4 py-2">Sent</th>
                <th className="text-left px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((r) => (
                <tr key={r.id} className="border-t border-[color:var(--rule)]">
                  <td className="px-4 py-2">
                    <Link
                      href={`/admin/events/${slug}/attendees`}
                      className="font-semibold text-navy hover:underline"
                    >
                      {r.display_name ?? "—"}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-[color:var(--muted)] break-all">{r.email ?? "—"}</td>
                  <td className="px-4 py-2 text-[color:var(--muted)]">{fmtDateTime(r.sent_at)}</td>
                  <td className="px-4 py-2">
                    <StatusBadge status={r.status} opened={r.opened_at} clicked={r.clicked_at} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function StatusBadge({
  status,
  opened,
  clicked,
}: {
  status: string | null;
  opened: string | null;
  clicked: string | null;
}) {
  if (clicked) return <Badge tone="green">Clicked</Badge>;
  if (opened) return <Badge tone="green">Opened</Badge>;
  if (status === "bounced") return <Badge tone="red">Bounced</Badge>;
  if (status === "failed") return <Badge tone="red">Failed</Badge>;
  return <Badge tone="muted">{status ?? "sent"}</Badge>;
}

function Badge({
  tone,
  children,
}: {
  tone: "green" | "red" | "muted";
  children: React.ReactNode;
}) {
  const cls =
    tone === "green"
      ? "bg-green-50 border-green-200 text-green-800"
      : tone === "red"
        ? "bg-red-50 border-red-200 text-red-800"
        : "bg-ivory-2 border-[color:var(--rule)] text-[color:var(--muted)]";
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded border uppercase tracking-wider font-bold ${cls}`}>
      {children}
    </span>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <div
      className={`bg-white border ${
        accent ? "border-orange-300" : "border-[color:var(--rule)]"
      } rounded-[10px] p-4`}
    >
      <div className="text-[11px] tracking-[.22em] uppercase font-bold text-[color:var(--muted)]">
        {label}
      </div>
      <div className="text-xl font-sans font-bold text-[color:var(--navy-ink)] mt-1 break-words">
        {value}
      </div>
    </div>
  );
}

function SubTab({
  href,
  active,
  children,
}: {
  href: string;
  active?: boolean;
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
      {children}
    </Link>
  );
}
