import Link from "next/link";
import { sql } from "@/lib/db";
import { CompanyLogo } from "@/components/directory/CompanyLogo";
import {
  extractCountryCodes,
  originCountryNames,
} from "@/lib/country-flag";
import { normalizeCity } from "@/lib/city-normalize";

export const dynamic = "force-dynamic";

/* ----------------------------- helpers ----------------------------- */

function flagEmoji(iso2: string): string {
  const A = 127397;
  return String.fromCodePoint(
    ...iso2.toUpperCase().split("").map((c) => A + c.charCodeAt(0)),
  );
}

function regionNameFor(iso2: string): string {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(iso2) ?? iso2;
  } catch {
    return iso2;
  }
}

const SIZE_BAND_LABELS: Record<string, string> = {
  startup: "Startup (1–50)",
  small: "Small (51–500)",
  mid: "Mid (501–5K)",
  large: "Large (5K–50K)",
  enterprise: "Enterprise (50K+)",
};
const SIZE_BAND_ORDER = ["startup", "small", "mid", "large", "enterprise"];
function sizeBandOf(raw: string | null): string | null {
  if (!raw) return null;
  if (raw === "1-10" || raw === "11-50") return "startup";
  if (raw === "51-200" || raw === "201-500") return "small";
  if (raw === "501-1000" || raw === "1001-5000") return "mid";
  if (raw === "5001-10000") return "large";
  if (raw === "10001+") return "enterprise";
  return null;
}

const EXP_BAND_LABELS: Record<string, string> = {
  "0-3": "0–3 yrs (early)",
  "3-7": "3–7 yrs",
  "7-15": "7–15 yrs",
  "15+": "15+ yrs (senior)",
};
const EXP_BAND_ORDER = ["0-3", "3-7", "7-15", "15+"];

/* --------------------------- aggregations -------------------------- */

const ALUM_WHERE = sql`
  affiliation ILIKE '%alum%'
  AND deceased IS NOT TRUE
  AND moved_out IS NOT TRUE
`;

async function fetchAll() {
  const [
    companies,
    pastCompanies,
    uwcs,
    universities,
    industries,
    sizeRows,
    cities,
    regions,
    originsRaw,
    decadesRaw,
    expRaw,
    totalAlumni,
  ] = await Promise.all([
    sql`
      SELECT
        current_company AS name,
        MAX(current_company_linkedin) AS linkedin,
        MAX(current_company_website) AS website,
        MAX(current_company_logo_url) AS logo,
        COUNT(*)::int AS n
      FROM alumni
      WHERE current_company IS NOT NULL
        AND TRIM(current_company) <> ''
        AND affiliation ILIKE '%alum%'
        AND deceased IS NOT TRUE AND moved_out IS NOT TRUE
      GROUP BY current_company
      HAVING COUNT(*) >= 2
      ORDER BY n DESC, current_company ASC
      LIMIT 80
    `,
    sql`
      SELECT
        c.company AS name,
        MAX(c.company_linkedin_url) AS linkedin,
        MAX(c.company_website) AS website,
        MAX(c.company_logo_url) AS logo,
        COUNT(DISTINCT a.id)::int AS n
      FROM alumni_career c
      JOIN alumni a ON a.id = c.alumni_id
      WHERE c.company IS NOT NULL AND TRIM(c.company) <> ''
        AND c.company !~ '^[0-9]+$'  -- skip stray LinkedIn companyIds
        AND a.affiliation ILIKE '%alum%'
        AND a.deceased IS NOT TRUE AND a.moved_out IS NOT TRUE
      GROUP BY c.company
      HAVING COUNT(DISTINCT a.id) >= 3
      ORDER BY n DESC, c.company ASC
      LIMIT 60
    `,
    sql`
      SELECT uwc_college AS name, COUNT(*)::int AS n
      FROM alumni
      WHERE uwc_college IS NOT NULL
        AND affiliation ILIKE '%alum%'
        AND deceased IS NOT TRUE AND moved_out IS NOT TRUE
      GROUP BY uwc_college
      ORDER BY n DESC, uwc_college ASC
    `,
    sql`
      SELECT e.school AS name, COUNT(DISTINCT a.id)::int AS n
      FROM alumni_education e
      JOIN alumni a ON a.id = e.alumni_id
      WHERE e.is_uwc IS NOT TRUE
        AND e.school IS NOT NULL AND TRIM(e.school) <> ''
        AND a.affiliation ILIKE '%alum%'
        AND a.deceased IS NOT TRUE AND a.moved_out IS NOT TRUE
      GROUP BY e.school
      HAVING COUNT(DISTINCT a.id) >= 2
      ORDER BY n DESC, e.school ASC
      LIMIT 50
    `,
    sql`
      SELECT current_company_industry AS name, COUNT(*)::int AS n
      FROM alumni
      WHERE current_company_industry IS NOT NULL
        AND affiliation ILIKE '%alum%'
        AND deceased IS NOT TRUE AND moved_out IS NOT TRUE
      GROUP BY current_company_industry
      ORDER BY n DESC, current_company_industry ASC
      LIMIT 40
    `,
    sql`
      SELECT current_company_size AS raw, COUNT(*)::int AS n
      FROM alumni
      WHERE current_company_size IS NOT NULL
        AND affiliation ILIKE '%alum%'
        AND deceased IS NOT TRUE AND moved_out IS NOT TRUE
      GROUP BY current_company_size
    `,
    sql`
      SELECT current_city AS name, COUNT(*)::int AS n
      FROM alumni
      WHERE current_city IS NOT NULL AND TRIM(current_city) <> ''
        AND affiliation ILIKE '%alum%'
        AND deceased IS NOT TRUE AND moved_out IS NOT TRUE
      GROUP BY current_city
      ORDER BY n DESC, current_city ASC
    `,
    sql`
      SELECT region AS name, COUNT(*)::int AS n
      FROM alumni
      WHERE region IS NOT NULL
        AND affiliation ILIKE '%alum%'
        AND deceased IS NOT TRUE AND moved_out IS NOT TRUE
      GROUP BY region
      ORDER BY n DESC, region ASC
    `,
    sql`
      SELECT origin AS raw, COUNT(*)::int AS n
      FROM alumni
      WHERE origin IS NOT NULL AND TRIM(origin) <> ''
        AND affiliation ILIKE '%alum%'
        AND deceased IS NOT TRUE AND moved_out IS NOT TRUE
      GROUP BY origin
    `,
    sql`
      SELECT
        CASE
          WHEN grad_year < 1990 THEN '1980s'
          WHEN grad_year < 2000 THEN '1990s'
          WHEN grad_year < 2010 THEN '2000s'
          WHEN grad_year < 2020 THEN '2010s'
          ELSE '2020s'
        END AS decade,
        CASE
          WHEN grad_year < 1990 THEN 1980
          WHEN grad_year < 2000 THEN 1990
          WHEN grad_year < 2010 THEN 2000
          WHEN grad_year < 2020 THEN 2010
          ELSE 2020
        END AS decade_start,
        COUNT(*)::int AS n
      FROM alumni
      WHERE grad_year IS NOT NULL
        AND affiliation ILIKE '%alum%'
        AND deceased IS NOT TRUE AND moved_out IS NOT TRUE
      GROUP BY decade, decade_start
      ORDER BY decade_start
    `,
    sql`
      SELECT
        CASE
          WHEN total_experience_years::numeric < 3 THEN '0-3'
          WHEN total_experience_years::numeric < 7 THEN '3-7'
          WHEN total_experience_years::numeric < 15 THEN '7-15'
          ELSE '15+'
        END AS band,
        COUNT(*)::int AS n
      FROM alumni
      WHERE total_experience_years IS NOT NULL
        AND affiliation ILIKE '%alum%'
        AND deceased IS NOT TRUE AND moved_out IS NOT TRUE
      GROUP BY band
    `,
    sql`
      SELECT COUNT(*)::int AS n FROM alumni
      WHERE affiliation ILIKE '%alum%'
        AND deceased IS NOT TRUE AND moved_out IS NOT TRUE
    `,
  ]);

  return {
    companies: companies as Array<{
      name: string;
      linkedin: string | null;
      website: string | null;
      logo: string | null;
      n: number;
    }>,
    pastCompanies: pastCompanies as Array<{
      name: string;
      linkedin: string | null;
      website: string | null;
      logo: string | null;
      n: number;
    }>,
    uwcs: uwcs as Array<{ name: string; n: number }>,
    universities: universities as Array<{ name: string; n: number }>,
    industries: industries as Array<{ name: string; n: number }>,
    sizeRows: sizeRows as Array<{ raw: string; n: number }>,
    cities: cities as Array<{ name: string; n: number }>,
    regions: regions as Array<{ name: string; n: number }>,
    originsRaw: originsRaw as Array<{ raw: string; n: number }>,
    decadesRaw: decadesRaw as Array<{
      decade: string;
      decade_start: number;
      n: number;
    }>,
    expRaw: expRaw as Array<{ band: string; n: number }>,
    totalAlumni: (totalAlumni as Array<{ n: number }>)[0].n,
  };
}

/* --------------------- post-processing in JS ----------------------- */

function rollupSizeBands(rows: Array<{ raw: string; n: number }>) {
  const acc: Record<string, number> = {};
  for (const r of rows) {
    const band = sizeBandOf(r.raw);
    if (!band) continue;
    acc[band] = (acc[band] ?? 0) + r.n;
  }
  return SIZE_BAND_ORDER.filter((b) => acc[b])
    .map((b) => ({ band: b, label: SIZE_BAND_LABELS[b], n: acc[b] }));
}

/** Display-time city rollup: merges variant spellings ("SF" + "San
 * Francisco" + "(soon!) San Francisco" + "San francisco") into a
 * single canonical row. Picks the largest-cluster raw value as the
 * filter target so the click-through ILIKE match still works against
 * the un-normalized DB. */
function rollupCities(rows: Array<{ name: string; n: number }>, limit = 30) {
  const acc = new Map<
    string,
    { display: string; n: number; rawByCount: Map<string, number> }
  >();
  for (const r of rows) {
    const norm = normalizeCity(r.name);
    if (!norm) continue;
    const cur = acc.get(norm.key) ?? {
      display: norm.display,
      n: 0,
      rawByCount: new Map<string, number>(),
    };
    cur.n += r.n;
    cur.rawByCount.set(r.name, (cur.rawByCount.get(r.name) ?? 0) + r.n);
    acc.set(norm.key, cur);
  }
  return Array.from(acc.values())
    .map((v) => {
      // Use the raw value with the highest count as the filter target
      // — captures the largest fraction of the cluster via ILIKE.
      let best = "";
      let bestN = -1;
      for (const [raw, n] of v.rawByCount) {
        if (n > bestN) {
          best = raw;
          bestN = n;
        }
      }
      return { display: v.display, n: v.n, filterValue: best };
    })
    .sort((a, b) => b.n - a.n)
    .slice(0, limit);
}

function rollupOrigins(rows: Array<{ raw: string; n: number }>) {
  const acc = new Map<string, { iso: string; n: number; rawSamples: Set<string> }>();
  for (const r of rows) {
    const codes = extractCountryCodes(r.raw, 1);
    if (codes.length === 0) continue;
    const iso = codes[0];
    const cur = acc.get(iso) ?? { iso, n: 0, rawSamples: new Set<string>() };
    cur.n += r.n;
    cur.rawSamples.add(r.raw);
    acc.set(iso, cur);
  }
  return Array.from(acc.values())
    .map((v) => ({
      iso: v.iso,
      n: v.n,
      // Pick the cleanest (shortest) raw value to use as the origin
      // filter so e.g. "Brazil" wins over "Brazil/France".
      filterValue: Array.from(v.rawSamples)
        .sort((a, b) => a.length - b.length)[0],
      label: regionNameFor(v.iso),
      flag: flagEmoji(v.iso),
    }))
    .sort((a, b) => b.n - a.n);
}

/* ----------------------------- UI bits ----------------------------- */

function SectionCard({
  title,
  emoji,
  total,
  children,
}: {
  title: string;
  emoji: string;
  total: number;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-[color:var(--rule)] rounded-[10px] p-4 sm:p-5">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-[11px] tracking-[.22em] uppercase font-bold text-navy">
          {emoji} {title}
        </h2>
        <span className="text-[11px] text-[color:var(--muted)]">
          {total} {total === 1 ? "entry" : "entries"}
        </span>
      </div>
      {children}
    </div>
  );
}

function CountRow({
  href,
  count,
  children,
}: {
  href: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-3 py-1.5 px-1 rounded hover:bg-[color:var(--ivory-2)] text-sm"
    >
      <span className="min-w-0 truncate text-[color:var(--navy-ink)]">
        {children}
      </span>
      <span className="shrink-0 inline-flex items-center justify-center min-w-[28px] h-[20px] rounded bg-ivory-2 border border-[color:var(--rule)] text-xs font-semibold text-navy tabular-nums px-1.5">
        {count}
      </span>
    </Link>
  );
}

/* ------------------------------ Page ------------------------------- */

export default async function SnapshotPage() {
  const data = await fetchAll();
  const sizeBands = rollupSizeBands(data.sizeRows);
  const origins = rollupOrigins(data.originsRaw);
  const cities = rollupCities(data.cities, 30);
  const expBands = data.expRaw
    .slice()
    .sort(
      (a, b) => EXP_BAND_ORDER.indexOf(a.band) - EXP_BAND_ORDER.indexOf(b.band),
    );

  return (
    <section className="max-w-[1180px] mx-auto px-5 sm:px-7 py-8">
      <div className="mb-6">
        <h1 className="font-sans text-[28px] sm:text-[34px] font-bold text-[color:var(--navy-ink)] tracking-[-0.01em]">
          Snapshot
        </h1>
        <p className="text-sm text-[color:var(--muted)] mt-1.5 max-w-[68ch]">
          A bird's-eye view of where the {data.totalAlumni} alumni in the
          directory cluster — by company, school, industry, location, and
          more. Click any row to drill into a filtered directory view.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {/* 1. Current companies (≥2 alumni) */}
        <SectionCard
          title="Where alumni work now"
          emoji="🏢"
          total={data.companies.length}
        >
          <ul className="space-y-0.5">
            {data.companies.map((c) => (
              <li key={c.name}>
                <Link
                  href={`/directory?company=${encodeURIComponent(c.name)}`}
                  className="flex items-center justify-between gap-3 py-1.5 px-1 rounded hover:bg-[color:var(--ivory-2)] text-sm"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <CompanyLogo
                      storedLogoUrl={c.logo}
                      website={c.website}
                      linkedinUrl={c.linkedin}
                      companyName={c.name}
                      size={20}
                    />
                    <span className="truncate text-[color:var(--navy-ink)] font-medium">
                      {c.name}
                    </span>
                  </span>
                  <span className="shrink-0 inline-flex items-center justify-center min-w-[28px] h-[20px] rounded bg-ivory-2 border border-[color:var(--rule)] text-xs font-semibold text-navy tabular-nums px-1.5">
                    {c.n}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </SectionCard>

        {/* 2. UWC schools */}
        <SectionCard title="UWC" emoji="🌐" total={data.uwcs.length}>
          <ul className="space-y-0.5">
            {data.uwcs.map((u) => (
              <li key={u.name}>
                <CountRow
                  href={`/directory?college=${encodeURIComponent(u.name)}`}
                  count={u.n}
                >
                  {u.name}
                </CountRow>
              </li>
            ))}
          </ul>
        </SectionCard>

        {/* 3. Universities */}
        <SectionCard
          title="University"
          emoji="🏛️"
          total={data.universities.length}
        >
          <ul className="space-y-0.5">
            {data.universities.map((u) => (
              <li key={u.name}>
                <CountRow
                  href={`/directory?university=${encodeURIComponent(u.name)}`}
                  count={u.n}
                >
                  {u.name}
                </CountRow>
              </li>
            ))}
          </ul>
        </SectionCard>

        {/* 4. Industries */}
        <SectionCard
          title="Industry"
          emoji="💼"
          total={data.industries.length}
        >
          <ul className="space-y-0.5">
            {data.industries.map((i) => (
              <li key={i.name}>
                <CountRow
                  href={`/directory?industry=${encodeURIComponent(i.name)}`}
                  count={i.n}
                >
                  {i.name}
                </CountRow>
              </li>
            ))}
          </ul>
        </SectionCard>

        {/* 5. Company size */}
        <SectionCard
          title="Company size"
          emoji="📊"
          total={sizeBands.length}
        >
          <ul className="space-y-0.5">
            {sizeBands.map((b) => (
              <li key={b.band}>
                <CountRow
                  href={`/directory?companySizeBand=${b.band}`}
                  count={b.n}
                >
                  {b.label}
                </CountRow>
              </li>
            ))}
          </ul>
        </SectionCard>

        {/* 6. Cities */}
        <SectionCard title="City" emoji="🏙️" total={cities.length}>
          <ul className="space-y-0.5">
            {cities.map((c) => (
              <li key={c.display}>
                <CountRow
                  href={`/directory?city=${encodeURIComponent(c.filterValue)}`}
                  count={c.n}
                >
                  {c.display}
                </CountRow>
              </li>
            ))}
          </ul>
        </SectionCard>

        {/* 7. Regions */}
        <SectionCard title="Region" emoji="🌉" total={data.regions.length}>
          <ul className="space-y-0.5">
            {data.regions.map((r) => (
              <li key={r.name}>
                <CountRow
                  href={`/directory?region=${encodeURIComponent(r.name)}`}
                  count={r.n}
                >
                  {r.name}
                </CountRow>
              </li>
            ))}
          </ul>
        </SectionCard>

        {/* 8. Country of origin */}
        <SectionCard
          title="Origin"
          emoji="🌍"
          total={origins.length}
        >
          <ul className="space-y-0.5">
            {origins.map((o) => (
              <li key={o.iso}>
                <CountRow
                  href={`/directory?origin=${encodeURIComponent(o.filterValue)}`}
                  count={o.n}
                >
                  <span
                    className="mr-2 text-[16px] leading-none text-black"
                    style={{ fontVariantEmoji: "emoji" }}
                  >
                    {o.flag}
                  </span>
                  {o.label}
                </CountRow>
              </li>
            ))}
          </ul>
        </SectionCard>

        {/* 9. Graduation decade */}
        <SectionCard
          title="UWC graduation decade"
          emoji="🎓"
          total={data.decadesRaw.length}
        >
          <ul className="space-y-0.5">
            {data.decadesRaw.map((d) => (
              <li key={d.decade}>
                <CountRow
                  href={`/directory?yearFrom=${d.decade_start}&yearTo=${d.decade_start + 9}`}
                  count={d.n}
                >
                  {d.decade}
                </CountRow>
              </li>
            ))}
          </ul>
        </SectionCard>

        {/* 10. Experience */}
        <SectionCard
          title="Experience"
          emoji="⏱️"
          total={expBands.length}
        >
          <ul className="space-y-0.5">
            {expBands.map((b) => (
              <li key={b.band}>
                <CountRow
                  href={`/directory?expBand=${encodeURIComponent(b.band)}`}
                  count={b.n}
                >
                  {EXP_BAND_LABELS[b.band] ?? b.band}
                </CountRow>
              </li>
            ))}
          </ul>
        </SectionCard>

        {/* 11. Past employers (alumni who've ever worked there) */}
        <SectionCard
          title="Past employers (≥3 alumni)"
          emoji="🏷️"
          total={data.pastCompanies.length}
        >
          <ul className="space-y-0.5">
            {data.pastCompanies.map((c) => (
              <li key={c.name}>
                <Link
                  href={`/directory?q=${encodeURIComponent(c.name)}`}
                  className="flex items-center justify-between gap-3 py-1.5 px-1 rounded hover:bg-[color:var(--ivory-2)] text-sm"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <CompanyLogo
                      storedLogoUrl={c.logo}
                      website={c.website}
                      linkedinUrl={c.linkedin}
                      companyName={c.name}
                      size={20}
                    />
                    <span className="truncate text-[color:var(--navy-ink)]">
                      {c.name}
                    </span>
                  </span>
                  <span className="shrink-0 inline-flex items-center justify-center min-w-[28px] h-[20px] rounded bg-ivory-2 border border-[color:var(--rule)] text-xs font-semibold text-navy tabular-nums px-1.5">
                    {c.n}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>
    </section>
  );
}
