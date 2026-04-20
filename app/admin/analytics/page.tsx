import {
  getRecentVisits,
  getTopReferrerDomains,
  getTopCountries,
  getPageviews,
  sum,
} from "@/lib/analytics";
import { fmtDateTimeShort } from "@/lib/admin-time";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const [recent, referrers, countries, homePv30] = await Promise.all([
    getRecentVisits(200),
    getTopReferrerDomains(30),
    getTopCountries(30),
    getPageviews("/", 30),
  ]);
  const totalVisitsRecent = recent.length;
  const homeTotal30 = sum(homePv30);

  return (
    <div className="max-w-[1100px]">
      <h1 className="font-sans text-3xl font-bold text-[color:var(--navy-ink)] mb-1">Analytics</h1>
      <p className="text-[color:var(--muted)] text-sm mb-6">
        Per-visit rows store time, referrer domain, and coarse (city/region/country) location.
        No IPs. Bots filtered out. Daily counter (Upstash) powers the totals on the overview.
      </p>

      <div className="grid gap-4 sm:grid-cols-3 mb-8">
        <Tile label="Recent visits shown" value={totalVisitsRecent} />
        <Tile label="Home pageviews · 30d" value={homeTotal30} />
        <Tile label="Unique referrer domains · 30d" value={referrers.filter((r) => r.referrer_domain).length} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2 mb-8">
        <Card title="Top referrer domains · 30 days">
          {referrers.length === 0 ? (
            <Empty>No data yet.</Empty>
          ) : (
            <Table>
              <thead>
                <tr><Th>Domain</Th><Th className="text-right">Visits</Th></tr>
              </thead>
              <tbody>
                {referrers.map((r, i) => (
                  <tr key={i} className="border-t border-[color:var(--rule)]">
                    <Td>
                      {r.referrer_domain
                        ? <span className="font-mono text-[12px]">{r.referrer_domain}</span>
                        : <span className="text-[color:var(--muted)] italic">(direct / no referrer)</span>}
                    </Td>
                    <Td className="text-right tabular-nums">{r.visits}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <Card title="Top countries · 30 days">
          {countries.length === 0 ? (
            <Empty>No data yet.</Empty>
          ) : (
            <Table>
              <thead>
                <tr><Th>Country</Th><Th className="text-right">Visits</Th></tr>
              </thead>
              <tbody>
                {countries.map((c, i) => (
                  <tr key={i} className="border-t border-[color:var(--rule)]">
                    <Td>{c.country ?? <span className="text-[color:var(--muted)] italic">unknown</span>}</Td>
                    <Td className="text-right tabular-nums">{c.visits}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </div>

      <Card title={`Recent visits (${recent.length})`}>
        {recent.length === 0 ? (
          <Empty>No visits recorded yet. Data starts populating after the next deploy.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <thead>
                <tr>
                  <Th>Time</Th>
                  <Th>Path</Th>
                  <Th>Referrer</Th>
                  <Th>Location</Th>
                </tr>
              </thead>
              <tbody>
                {recent.map((r) => (
                  <tr key={r.id} className="border-t border-[color:var(--rule)] hover:bg-ivory">
                    <Td className="whitespace-nowrap text-xs text-[color:var(--muted)]">
                      {fmtDateTimeShort(r.created_at)}
                    </Td>
                    <Td><span className="font-mono text-[12px]">{r.path}</span></Td>
                    <Td>
                      {r.referrer_domain
                        ? <span className="font-mono text-[12px]">{r.referrer_domain}</span>
                        : <span className="text-[color:var(--muted)] italic">direct</span>}
                    </Td>
                    <Td className="text-xs">
                      {[r.city, r.region, r.country].filter(Boolean).join(" · ") ||
                        <span className="text-[color:var(--muted)] italic">—</span>}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// tiny UI primitives (inline, no need to share these)
// ---------------------------------------------------------------------------

function Tile({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white border border-[color:var(--rule)] rounded-[10px] p-4">
      <div className="text-[11px] tracking-[.22em] uppercase font-bold text-[color:var(--muted)]">{label}</div>
      <div className="mt-1 text-2xl font-sans font-bold text-[color:var(--navy-ink)]">{value.toLocaleString()}</div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-[color:var(--rule)] rounded-[10px] overflow-hidden mb-6">
      <div className="px-5 py-3 border-b border-[color:var(--rule)]">
        <h2 className="text-[11px] tracking-[.22em] uppercase font-bold text-navy">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Table({ children }: { children: React.ReactNode }) {
  return <table className="w-full text-sm">{children}</table>;
}
function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`text-left px-4 py-2.5 bg-ivory-2 text-[11px] tracking-[.18em] uppercase font-bold text-[color:var(--muted)] ${className}`}>
      {children}
    </th>
  );
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-2.5 align-top ${className}`}>{children}</td>;
}
function Empty({ children }: { children: React.ReactNode }) {
  return <p className="p-5 text-sm text-[color:var(--muted)]">{children}</p>;
}
