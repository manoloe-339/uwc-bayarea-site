import { sql } from "@/lib/db";
import { getPageviews, getClicks, sum, type DailyCount } from "@/lib/analytics";

export const dynamic = "force-dynamic";

async function getTotalAlumni(): Promise<number> {
  const rows = await sql`SELECT COUNT(*)::int AS n FROM alumni`;
  return (rows[0] as { n: number }).n;
}

async function getTopCities(limit = 5): Promise<{ city: string; n: number }[]> {
  const rows = await sql`
    SELECT lower(trim(current_city)) AS city, COUNT(*)::int AS n
    FROM alumni
    WHERE current_city IS NOT NULL AND trim(current_city) <> ''
    GROUP BY lower(trim(current_city))
    ORDER BY n DESC
    LIMIT ${limit}
  `;
  return rows as { city: string; n: number }[];
}

async function getCollegeBreakdown(limit = 6): Promise<{ uwc_college: string; n: number }[]> {
  const rows = await sql`
    SELECT COALESCE(uwc_college, 'Unknown') AS uwc_college, COUNT(*)::int AS n
    FROM alumni
    GROUP BY uwc_college
    ORDER BY n DESC
    LIMIT ${limit}
  `;
  return rows as { uwc_college: string; n: number }[];
}

async function getRegionBreakdown(): Promise<{ region: string; n: number }[]> {
  const rows = await sql`
    SELECT COALESCE(region, 'Unknown') AS region, COUNT(*)::int AS n
    FROM alumni
    GROUP BY region
    ORDER BY n DESC
  `;
  return rows as { region: string; n: number }[];
}

export default async function AdminHome() {
  const [
    homePv,
    signupPv,
    ticketClicks,
    signupClicks,
    totalAlumni,
    topCities,
    colleges,
    regions,
  ] = await Promise.all([
    getPageviews("/", 7),
    getPageviews("/signup", 7),
    getClicks("ticket", 7),
    getClicks("signup", 7),
    getTotalAlumni(),
    getTopCities(5),
    getCollegeBreakdown(8),
    getRegionBreakdown(),
  ]);

  return (
    <div>
      <h1 className="font-sans text-4xl font-bold text-[color:var(--navy-ink)] mb-1">Overview</h1>
      <p className="text-[color:var(--muted)] text-sm mb-8">Last 7 days (Pacific time).</p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <Tile label="Home views" value={sum(homePv)} series={homePv} />
        <Tile label="/signup views" value={sum(signupPv)} series={signupPv} />
        <Tile label="Ticket clicks" value={sum(ticketClicks)} series={ticketClicks} />
        <Tile label="Total alumni" value={totalAlumni} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="By region">
          {regions.length === 0 ? (
            <Empty />
          ) : (
            <ul>
              {regions.map((r) => (
                <li key={r.region} className="flex justify-between py-1.5 border-b border-[color:var(--rule)] last:border-0">
                  <span>{r.region}</span>
                  <span className="font-semibold">{r.n}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Top cities">
          {topCities.length === 0 ? (
            <Empty />
          ) : (
            <ul>
              {topCities.map((c) => (
                <li key={c.city} className="flex justify-between py-1.5 border-b border-[color:var(--rule)] last:border-0">
                  <span className="capitalize">{c.city}</span>
                  <span className="font-semibold">{c.n}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Colleges represented">
          {colleges.length === 0 ? (
            <Empty />
          ) : (
            <ul>
              {colleges.map((c) => (
                <li key={c.uwc_college} className="flex justify-between py-1.5 border-b border-[color:var(--rule)] last:border-0">
                  <span>{c.uwc_college}</span>
                  <span className="font-semibold">{c.n}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {totalAlumni === 0 && (
        <div className="mt-8 p-5 bg-ivory-2 border-l-4 border-navy rounded-[2px] text-sm">
          No alumni imported yet — head to <a className="font-semibold text-navy underline" href="/admin/import">Import</a> to upload a Google Form CSV.
        </div>
      )}
    </div>
  );
}

function Tile({ label, value, series }: { label: string; value: number; series?: DailyCount[] }) {
  const max = series ? Math.max(1, ...series.map((s) => s.count)) : 0;
  return (
    <div className="bg-white border border-[color:var(--rule)] rounded-[10px] p-5 shadow-[0_2px_0_var(--ivory-3)]">
      <div className="text-[11px] tracking-[.22em] uppercase font-bold text-[color:var(--muted)]">{label}</div>
      <div className="mt-1 text-3xl font-sans font-bold text-[color:var(--navy-ink)]">{value.toLocaleString()}</div>
      {series && series.length > 0 && (
        <div className="mt-3 flex items-end gap-1 h-8">
          {series.map((d) => (
            <div
              key={d.day}
              title={`${d.day}: ${d.count}`}
              className="flex-1 rounded-sm bg-navy/80"
              style={{ height: `${Math.max(4, (d.count / max) * 100)}%` }}
            />
          ))}
        </div>
      )}
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
