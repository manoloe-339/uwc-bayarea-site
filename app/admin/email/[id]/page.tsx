import Link from "next/link";
import { notFound } from "next/navigation";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

type Campaign = {
  id: string;
  subject: string;
  body: string;
  recipient_count: number;
  sent_count: number;
  failed_count: number;
  created_at: string;
  created_by: string | null;
  filter_snapshot: Record<string, unknown> | null;
};

type SendRow = {
  email: string;
  status: string;
  resend_message_id: string | null;
  error: string | null;
  sent_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  first_name: string | null;
  last_name: string | null;
  alumni_id: number | null;
};

export default async function CampaignDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rows = (await sql`SELECT * FROM email_campaigns WHERE id = ${id}`) as Campaign[];
  if (rows.length === 0) notFound();
  const c = rows[0];

  const [sendsRaw, talliesRaw] = await Promise.all([
    sql`
      SELECT s.email, s.status, s.resend_message_id, s.error, s.sent_at,
             s.opened_at, s.clicked_at, a.first_name, a.last_name, a.id AS alumni_id
      FROM email_sends s
      LEFT JOIN alumni a ON a.id = s.alumni_id
      WHERE s.campaign_id = ${id}
      ORDER BY s.created_at ASC
    `,
    sql`
      SELECT
        COUNT(*) FILTER (WHERE status = 'sent')::int    AS sent,
        COUNT(*) FILTER (WHERE status = 'failed')::int  AS failed,
        COUNT(*) FILTER (WHERE opened_at IS NOT NULL)::int  AS opened,
        COUNT(*) FILTER (WHERE clicked_at IS NOT NULL)::int AS clicked,
        COUNT(*) FILTER (WHERE bounced_at IS NOT NULL)::int AS bounced
      FROM email_sends WHERE campaign_id = ${id}
    `,
  ]);
  const sends = sendsRaw as unknown as SendRow[];
  const t = (talliesRaw as unknown as { sent: number; failed: number; opened: number; clicked: number; bounced: number }[])[0];

  return (
    <div>
      <div className="mb-4">
        <Link href="/admin/email" className="text-sm text-[color:var(--muted)] hover:text-navy">
          ← New email
        </Link>
      </div>
      <h1 className="font-sans text-3xl font-bold text-[color:var(--navy-ink)] mb-1">{c.subject}</h1>
      <p className="text-[color:var(--muted)] text-sm mb-6">
        Sent {new Date(c.created_at).toLocaleString()} · {c.recipient_count} recipients
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 mb-8">
        <Tile label="Sent" value={t.sent} />
        <Tile label="Failed" value={t.failed} tone={t.failed ? "warn" : "normal"} />
        <Tile label="Opened" value={t.opened} />
        <Tile label="Clicked" value={t.clicked} />
        <Tile label="Bounced" value={t.bounced} tone={t.bounced ? "warn" : "normal"} />
      </div>

      <section className="bg-white border border-[color:var(--rule)] rounded-[10px] p-5 mb-6">
        <h2 className="text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-2">Body</h2>
        <pre className="whitespace-pre-wrap text-sm text-[color:var(--navy-ink)]">{c.body}</pre>
      </section>

      <section className="bg-white border border-[color:var(--rule)] rounded-[10px] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-ivory-2 text-[11px] tracking-[.18em] uppercase font-bold text-[color:var(--muted)]">
            <tr>
              <Th>Recipient</Th>
              <Th>Status</Th>
              <Th>Opened</Th>
              <Th>Clicked</Th>
              <Th>Error</Th>
            </tr>
          </thead>
          <tbody>
            {sends.map((s, i) => (
              <tr key={`${s.email}-${i}`} className="border-t border-[color:var(--rule)]">
                <Td>
                  {s.alumni_id ? (
                    <Link href={`/admin/alumni/${s.alumni_id}`} className="text-navy hover:underline">
                      {[s.first_name, s.last_name].filter(Boolean).join(" ") || s.email}
                    </Link>
                  ) : (
                    s.email
                  )}{" "}
                  <span className="text-xs text-[color:var(--muted)]">{s.email}</span>
                </Td>
                <Td>
                  <span
                    className={`text-[10px] uppercase tracking-wider ${
                      s.status === "sent"
                        ? "text-green-800"
                        : s.status === "failed"
                          ? "text-red-700"
                          : "text-[color:var(--muted)]"
                    }`}
                  >
                    {s.status}
                  </span>
                </Td>
                <Td>{s.opened_at ? new Date(s.opened_at).toLocaleDateString() : "—"}</Td>
                <Td>{s.clicked_at ? new Date(s.clicked_at).toLocaleDateString() : "—"}</Td>
                <Td>{s.error ?? "—"}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Tile({ label, value, tone = "normal" }: { label: string; value: number; tone?: "normal" | "warn" }) {
  return (
    <div className="bg-white border border-[color:var(--rule)] rounded-[10px] p-4">
      <div className="text-[11px] tracking-[.22em] uppercase font-bold text-[color:var(--muted)]">{label}</div>
      <div className={`mt-1 text-2xl font-sans font-bold ${tone === "warn" ? "text-red-700" : "text-[color:var(--navy-ink)]"}`}>
        {value.toLocaleString()}
      </div>
    </div>
  );
}
function Th({ children }: { children: React.ReactNode }) {
  return <th className="text-left px-4 py-2.5">{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-2.5 align-top">{children}</td>;
}
