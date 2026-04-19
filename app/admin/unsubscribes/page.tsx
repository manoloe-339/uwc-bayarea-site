import Link from "next/link";
import { sql } from "@/lib/db";
import { reasonLabel } from "@/lib/unsubscribe-reasons";

export const dynamic = "force-dynamic";

type ReasonRow = { reason: string | null; n: number };
type EventRow = {
  id: string;
  event_type: string;
  reason: string | null;
  note: string | null;
  created_at: string;
  alumni_id: number | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

async function getTotals(): Promise<{ unsubscribed: number; subscribed: number }> {
  const rows = (await sql`
    SELECT
      SUM(CASE WHEN subscribed = FALSE THEN 1 ELSE 0 END)::int AS unsubscribed,
      SUM(CASE WHEN subscribed IS NOT FALSE THEN 1 ELSE 0 END)::int AS subscribed
    FROM alumni
  `) as { unsubscribed: number; subscribed: number }[];
  return rows[0] ?? { unsubscribed: 0, subscribed: 0 };
}

async function getReasonBreakdown(): Promise<ReasonRow[]> {
  return (await sql`
    SELECT unsubscribe_reason AS reason, COUNT(*)::int AS n
    FROM alumni
    WHERE subscribed = FALSE
    GROUP BY unsubscribe_reason
    ORDER BY n DESC
  `) as ReasonRow[];
}

async function getRecentEvents(limit = 20): Promise<EventRow[]> {
  return (await sql`
    SELECT
      e.id, e.event_type, e.reason, e.note, e.created_at,
      a.id AS alumni_id, a.first_name, a.last_name, a.email
    FROM unsubscribe_events e
    LEFT JOIN alumni a ON a.id = e.alumni_id
    ORDER BY e.created_at DESC
    LIMIT ${limit}
  `) as EventRow[];
}

export default async function UnsubscribesPage() {
  const [{ unsubscribed, subscribed }, reasons, events] = await Promise.all([
    getTotals(),
    getReasonBreakdown(),
    getRecentEvents(20),
  ]);

  return (
    <div>
      <h1 className="font-sans text-4xl font-bold text-[color:var(--navy-ink)] mb-1">Unsubscribes</h1>
      <p className="text-[color:var(--muted)] text-sm mb-8">
        {unsubscribed.toLocaleString()} unsubscribed · {subscribed.toLocaleString()} still subscribed
      </p>

      <div className="grid gap-6 lg:grid-cols-2 mb-8">
        <Card title="By reason">
          {reasons.length === 0 ? (
            <Empty />
          ) : (
            <ul>
              {reasons.map((r) => (
                <li
                  key={r.reason ?? "unknown"}
                  className="flex justify-between py-1.5 border-b border-[color:var(--rule)] last:border-0"
                >
                  <span>{reasonLabel(r.reason)}</span>
                  <span className="font-semibold">{r.n}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Tip">
          <p className="text-sm text-[color:var(--navy-ink)]">
            Head to <Link href="/admin/alumni?includeMovedOut=1&subscription=unsubscribed" className="text-navy underline">Alumni → Unsubscribed</Link> to see the full list.
          </p>
          <p className="text-sm text-[color:var(--navy-ink)] mt-2">
            A "moved" unsubscribe also flips the <span className="font-semibold">moved_out</span> flag, so those records stay out of default searches.
          </p>
        </Card>
      </div>

      <div className="bg-white border border-[color:var(--rule)] rounded-[10px] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-ivory-2 text-[11px] tracking-[.18em] uppercase font-bold text-[color:var(--muted)]">
            <tr>
              <Th>When</Th>
              <Th>Type</Th>
              <Th>Alumnus</Th>
              <Th>Reason</Th>
              <Th>Note</Th>
            </tr>
          </thead>
          <tbody>
            {events.length === 0 && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-[color:var(--muted)]">
                  No unsubscribe activity yet.
                </td>
              </tr>
            )}
            {events.map((e) => (
              <tr key={e.id} className="border-t border-[color:var(--rule)]">
                <Td>{new Date(e.created_at).toLocaleDateString()}</Td>
                <Td>
                  <span className={`text-[10px] uppercase tracking-wider ${e.event_type === "resubscribe" ? "text-green-700" : "text-[color:var(--muted)]"}`}>
                    {e.event_type.replace("_", " ")}
                  </span>
                </Td>
                <Td>
                  {e.alumni_id ? (
                    <Link href={`/admin/alumni/${e.alumni_id}`} className="text-navy hover:underline">
                      {[e.first_name, e.last_name].filter(Boolean).join(" ") || e.email || `#${e.alumni_id}`}
                    </Link>
                  ) : (
                    <span className="text-[color:var(--muted)]">(record deleted)</span>
                  )}
                </Td>
                <Td>{reasonLabel(e.reason)}</Td>
                <Td>
                  <span className="text-xs text-[color:var(--muted)]">
                    {e.note ? e.note.slice(0, 120) + (e.note.length > 120 ? "…" : "") : "—"}
                  </span>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-[color:var(--rule)] rounded-[10px] p-5 shadow-[0_2px_0_var(--ivory-3)]">
      <h2 className="text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-3">{title}</h2>
      {children}
    </div>
  );
}
function Empty() {
  return <div className="text-sm text-[color:var(--muted)]">No data yet.</div>;
}
function Th({ children }: { children: React.ReactNode }) {
  return <th className="text-left px-4 py-2.5">{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-2.5 align-top">{children}</td>;
}
