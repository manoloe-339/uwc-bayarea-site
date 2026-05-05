import Link from "next/link";
import { sql } from "@/lib/db";
import { fmtDateTimeShort } from "@/lib/admin-time";

type RegionRow = { region: string; n: number };
type CityRow = { city: string; n: number };
type CollegeRow = { uwc_college: string; n: number };
type RecentSignup = {
  id: number;
  first_name: string | null;
  last_name: string | null;
  email: string;
  uwc_college: string | null;
  grad_year: number | null;
  current_city: string | null;
  updated_at: string;
};

async function loadSnapshot() {
  const [regions, cities, colleges, recent, total] = await Promise.all([
    sql`
      SELECT COALESCE(region, 'Unknown') AS region, COUNT(*)::int AS n
      FROM alumni
      GROUP BY region ORDER BY n DESC
    `,
    sql`
      SELECT lower(trim(current_city)) AS city, COUNT(*)::int AS n
      FROM alumni
      WHERE current_city IS NOT NULL AND trim(current_city) <> ''
      GROUP BY lower(trim(current_city))
      ORDER BY n DESC
      LIMIT 5
    `,
    sql`
      SELECT COALESCE(uwc_college, 'Unknown') AS uwc_college, COUNT(*)::int AS n
      FROM alumni
      GROUP BY uwc_college ORDER BY n DESC LIMIT 8
    `,
    sql`
      SELECT id, first_name, last_name, email, uwc_college, grad_year, current_city, updated_at
      FROM alumni
      WHERE 'signup_form' = ANY(sources)
      ORDER BY updated_at DESC
      LIMIT 10
    `,
    sql`SELECT COUNT(*)::int AS n FROM alumni`,
  ]);
  return {
    regions: regions as RegionRow[],
    cities: cities as CityRow[],
    colleges: colleges as CollegeRow[],
    recent: recent as RecentSignup[],
    total: ((total as { n: number }[])[0]?.n ?? 0) as number,
  };
}

export async function DirectorySnapshot() {
  const { regions, cities, colleges, recent, total } = await loadSnapshot();

  return (
    <section className="mt-10">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-[12px] tracking-[.32em] uppercase font-bold text-navy m-0">
          Directory snapshot
        </h2>
        <span className="text-xs text-[color:var(--muted)]">
          {total.toLocaleString()} total alumni in directory
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <BreakdownCard title="By region">
          {regions.length === 0 ? (
            <Empty />
          ) : (
            <ul className="m-0 p-0 list-none">
              {regions.map((r) => (
                <Row key={r.region} label={r.region} value={r.n} />
              ))}
            </ul>
          )}
        </BreakdownCard>

        <BreakdownCard title="Top cities">
          {cities.length === 0 ? (
            <Empty />
          ) : (
            <ul className="m-0 p-0 list-none">
              {cities.map((c) => (
                <Row
                  key={c.city}
                  label={<span className="capitalize">{c.city}</span>}
                  value={c.n}
                />
              ))}
            </ul>
          )}
        </BreakdownCard>

        <BreakdownCard title="Colleges represented">
          {colleges.length === 0 ? (
            <Empty />
          ) : (
            <ul className="m-0 p-0 list-none">
              {colleges.map((c) => (
                <Row key={c.uwc_college} label={c.uwc_college} value={c.n} />
              ))}
            </ul>
          )}
        </BreakdownCard>
      </div>

      <div className="mt-4 bg-white border border-[color:var(--rule)] rounded-[10px] overflow-hidden">
        <div className="flex items-baseline justify-between px-4 sm:px-5 py-3 border-b border-[color:var(--rule)]">
          <h3 className="text-[11px] tracking-[.22em] uppercase font-bold text-navy m-0">
            Recent signups
          </h3>
          <Link
            href="/admin/alumni"
            className="text-xs text-[color:var(--muted)] hover:text-navy"
          >
            See all →
          </Link>
        </div>
        {recent.length === 0 ? (
          <div className="px-5 py-6 text-sm text-[color:var(--muted)]">
            No signups via the form yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-ivory-2 text-[11px] tracking-[.18em] uppercase font-bold text-[color:var(--muted)]">
                <tr>
                  <th className="text-left px-4 py-2">Name</th>
                  <th className="text-left px-4 py-2">College</th>
                  <th className="text-left px-4 py-2">Year</th>
                  <th className="text-left px-4 py-2">City</th>
                  <th className="text-left px-4 py-2 hidden sm:table-cell">Email</th>
                  <th className="text-left px-4 py-2">When</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((s) => (
                  <tr
                    key={s.id}
                    className="border-t border-[color:var(--rule)] hover:bg-ivory"
                  >
                    <td className="px-4 py-2">
                      <Link
                        href={`/admin/alumni/${s.id}`}
                        className="font-semibold text-navy hover:underline"
                      >
                        {[s.first_name, s.last_name].filter(Boolean).join(" ") || s.email}
                      </Link>
                    </td>
                    <td className="px-4 py-2">
                      {s.uwc_college ?? <span className="text-[color:var(--muted)]">—</span>}
                    </td>
                    <td className="px-4 py-2">
                      {s.grad_year ?? <span className="text-[color:var(--muted)]">—</span>}
                    </td>
                    <td className="px-4 py-2">{s.current_city ?? "—"}</td>
                    <td className="px-4 py-2 text-xs text-[color:var(--muted)] hidden sm:table-cell">
                      {s.email}
                    </td>
                    <td className="px-4 py-2 text-xs text-[color:var(--muted)] whitespace-nowrap">
                      {fmtDateTimeShort(s.updated_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

function BreakdownCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-[color:var(--rule)] rounded-[10px] p-5">
      <h3 className="text-[11px] tracking-[.22em] uppercase font-bold text-navy mb-3 m-0">
        {title}
      </h3>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: React.ReactNode; value: number }) {
  return (
    <li className="flex justify-between py-1.5 border-b border-[color:var(--rule)] last:border-0 text-sm text-[color:var(--navy-ink)]">
      <span>{label}</span>
      <span className="font-semibold">{value}</span>
    </li>
  );
}

function Empty() {
  return <div className="text-sm text-[color:var(--muted)]">No data yet.</div>;
}
