import Link from "next/link";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

type CampaignRow = {
  id: string;
  subject: string;
  created_at: string;
  created_by: string | null;
  recipient_count: number;
  sent: number;
  failed: number;
  opened: number;
  clicked: number;
  bounced: number;
};

export default async function CampaignHistory() {
  const rows = (await sql`
    SELECT
      c.id,
      c.subject,
      c.created_at,
      c.created_by,
      c.recipient_count,
      COUNT(*) FILTER (WHERE s.status = 'sent')::int            AS sent,
      COUNT(*) FILTER (WHERE s.status = 'failed')::int          AS failed,
      COUNT(*) FILTER (WHERE s.opened_at IS NOT NULL)::int      AS opened,
      COUNT(*) FILTER (WHERE s.clicked_at IS NOT NULL)::int     AS clicked,
      COUNT(*) FILTER (WHERE s.bounced_at IS NOT NULL)::int     AS bounced
    FROM email_campaigns c
    LEFT JOIN email_sends s ON s.campaign_id = c.id
    GROUP BY c.id
    ORDER BY c.created_at DESC
  `) as CampaignRow[];

  return (
    <div>
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="font-sans text-4xl font-bold text-[color:var(--navy-ink)]">Campaign history</h1>
          <p className="text-[color:var(--muted)] text-sm">
            {rows.length} past {rows.length === 1 ? "campaign" : "campaigns"}
          </p>
        </div>
        <Link
          href="/admin/email"
          className="text-sm font-semibold text-white bg-navy px-4 py-2 rounded"
        >
          New email →
        </Link>
      </div>

      <div className="bg-white border border-[color:var(--rule)] rounded-[10px] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-ivory-2 text-[11px] tracking-[.18em] uppercase font-bold text-[color:var(--muted)]">
            <tr>
              <Th>Subject</Th>
              <Th>Sent</Th>
              <Th>Recipients</Th>
              <Th>Delivered</Th>
              <Th>Opened</Th>
              <Th>Clicked</Th>
              <Th>Bounced</Th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-[color:var(--muted)]">
                  No campaigns yet. <Link href="/admin/email" className="text-navy underline">Compose one →</Link>
                </td>
              </tr>
            )}
            {rows.map((c) => (
              <tr key={c.id} className="border-t border-[color:var(--rule)] hover:bg-ivory">
                <Td>
                  <Link
                    href={`/admin/email/${c.id}`}
                    className="font-semibold text-navy hover:underline"
                  >
                    {c.subject}
                  </Link>
                </Td>
                <Td className="whitespace-nowrap text-xs text-[color:var(--muted)]">
                  {new Date(c.created_at).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </Td>
                <Td>{c.recipient_count.toLocaleString()}</Td>
                <Td>{c.sent.toLocaleString()}</Td>
                <Td>{c.opened.toLocaleString()}</Td>
                <Td>{c.clicked.toLocaleString()}</Td>
                <Td className={c.bounced > 0 ? "text-red-700" : ""}>{c.bounced.toLocaleString()}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="text-left px-4 py-2.5">{children}</th>;
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-2.5 align-top ${className}`}>{children}</td>;
}
