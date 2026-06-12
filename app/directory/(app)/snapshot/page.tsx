import Link from "next/link";
import { sql } from "@/lib/db";
import { CompanyLogo } from "@/components/directory/CompanyLogo";
import { SnapshotTile } from "@/components/directory/SnapshotTile";
import { DeepDiveNavCard } from "@/components/directory/DeepDiveNavCard";
import {
  DeepDiveFacetCard,
  type DeepDiveRow,
} from "@/components/directory/DeepDiveFacetCard";
import {
  SnapshotLensSwitcher,
  type LensId,
} from "@/components/directory/SnapshotLensSwitcher";
import { Icon, type IconName } from "@/components/directory/Icon";
import { FlagRect, UwcCoin } from "@/components/directory/Coins";
import {
  extractCountryCodes,
  originCountryNames,
} from "@/lib/country-flag";
import { normalizeCity } from "@/lib/city-normalize";
import { getFlagMap } from "@/lib/directory-lookups";

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
    stagesRaw,
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
      -- LEFT JOIN against uwc_assets to pull each school's curated
      -- logo + campus URL alongside the count. alumni.uwc_college is
      -- already normalized to match uwc_assets.canonical so a direct
      -- join works without going through normalizeCollege().
      SELECT a.uwc_college AS name,
             COUNT(*)::int AS n,
             MAX(u.logo_url) AS logo,
             MAX(u.campus_url) AS campus
      FROM alumni a
      LEFT JOIN uwc_assets u ON u.canonical = a.uwc_college
      WHERE a.uwc_college IS NOT NULL
        AND a.affiliation ILIKE '%alum%'
        AND a.deceased IS NOT TRUE AND a.moved_out IS NOT TRUE
      GROUP BY a.uwc_college
      ORDER BY n DESC, a.uwc_college ASC
    `,
    sql`
      SELECT e.school AS name,
             COUNT(DISTINCT a.id)::int AS n,
             -- MIN() rather than MAX() so we prefer the earliest-
             -- captured non-null logo (logos rarely change but we
             -- want a stable pick when multiple rows of the same
             -- school carry slightly different urls).
             MIN(e.school_logo_url) AS logo
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
    sql`
      SELECT
        CASE
          -- Timeline signal: a non-UWC education entry that has started
          -- but not yet ended. Year-precision only on the education
          -- columns; to handle "graduated in May 2026" not looking the
          -- same as "graduating Dec 2026", when end_year equals the
          -- current year we additionally require there to be NO
          -- current job — if they've already started a new position,
          -- their education is effectively over even if the year
          -- column hasn't ticked over.
          WHEN EXISTS (
            SELECT 1 FROM alumni_education e
            WHERE e.alumni_id = alumni.id
              AND e.is_uwc IS NOT TRUE
              AND (e.start_year IS NULL OR e.start_year <= EXTRACT(YEAR FROM NOW())::int)
              AND (
                -- Clearly ongoing: program ends in the future.
                e.end_year > EXTRACT(YEAR FROM NOW())::int
                -- End-date missing OR ends this year: only count as
                -- student when the alum has NO current job. A current
                -- job is treated as proof they're no longer enrolled —
                -- this catches data-quality cases like Logan Richard,
                -- whose Wharton / Stanford entries lacked dates entirely
                -- but who has a full-time job at Vanguard.
                OR (
                  (e.end_year IS NULL OR e.end_year = EXTRACT(YEAR FROM NOW())::int)
                  AND NOT EXISTS (
                    SELECT 1 FROM alumni_career c
                    WHERE c.alumni_id = alumni.id
                      AND c.is_current = TRUE
                  )
                )
              )
          )
          THEN 'student'
          ELSE 'working'
        END AS stage,
        COUNT(*)::int AS n
      FROM alumni
      WHERE affiliation ILIKE '%alum%'
        AND deceased IS NOT TRUE AND moved_out IS NOT TRUE
      GROUP BY stage
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
    uwcs: uwcs as Array<{ name: string; n: number; logo: string | null; campus: string | null }>,
    universities: universities as Array<{ name: string; n: number; logo: string | null }>,
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
    stagesRaw: stagesRaw as Array<{ stage: string; n: number }>,
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

/* ------------------------------ Page ------------------------------- */

const VALID_LENSES = ["background", "location", "career"] as const;
type SP = { lens?: string | string[] };

export default async function SnapshotPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const lensRaw = Array.isArray(sp.lens) ? sp.lens[0] : sp.lens;
  const lens: LensId | null = (VALID_LENSES as readonly string[]).includes(
    lensRaw ?? "",
  )
    ? (lensRaw as LensId)
    : null;

  const [data, flags] = await Promise.all([fetchAll(), getFlagMap()]);
  const sizeBands = rollupSizeBands(data.sizeRows);
  const origins = rollupOrigins(data.originsRaw);
  const cities = rollupCities(data.cities, 30);
  const studentCount =
    data.stagesRaw.find((s) => s.stage === "student")?.n ?? 0;
  const workingCount =
    data.stagesRaw.find((s) => s.stage === "working")?.n ?? 0;
  const expBands = data.expRaw
    .slice()
    .sort(
      (a, b) => EXP_BAND_ORDER.indexOf(a.band) - EXP_BAND_ORDER.indexOf(b.band),
    );

  // ---- Image-tile data (unchanged) ----
  const topUwc = data.uwcs[0];
  const topCohort = data.decadesRaw.slice().sort((a, b) => b.n - a.n)[0];
  const topCity = cities[0];
  const stripUwc = (s: string) => s.replace(/^UWC\s+/, "");
  const totalCountries = origins.length;

  // ---- Deep-dive facet builders. Each returns DeepDiveRow[] ----
  const uwcRows: DeepDiveRow[] = data.uwcs.map((u) => ({
    key: u.name,
    label: u.name,
    count: u.n,
    href: `/directory?college=${encodeURIComponent(u.name)}`,
    avatar: (
      <UwcCoin logoUrl={u.logo ?? null} campusName={stripUwc(u.name)} size={22} />
    ),
  }));
  const universityRows: DeepDiveRow[] = data.universities.map((u) => ({
    key: u.name,
    label: u.name,
    count: u.n,
    href: `/directory?university=${encodeURIComponent(u.name)}`,
    avatar: (
      <CompanyLogo
        storedLogoUrl={u.logo}
        website={null}
        linkedinUrl={null}
        companyName={u.name}
        size={22}
      />
    ),
  }));
  const originRows: DeepDiveRow[] = origins.map((o) => {
    const name = flags[o.iso.toLowerCase()]?.name ?? o.label;
    return {
      key: o.iso,
      label: name,
      count: o.n,
      href: `/directory?origin=${encodeURIComponent(o.filterValue)}`,
      avatar: (
        <FlagRect iso={o.iso} flag={flags[o.iso.toLowerCase()]} width={26} />
      ),
    };
  });
  const decadeRows: DeepDiveRow[] = data.decadesRaw.map((d) => ({
    key: d.decade,
    label: d.decade,
    count: d.n,
    href: `/directory?yearFrom=${d.decade_start}&yearTo=${d.decade_start + 9}`,
  }));
  const workNowRows: DeepDiveRow[] = data.companies.map((c) => ({
    key: c.name,
    label: c.name,
    count: c.n,
    href: `/directory?company=${encodeURIComponent(c.name)}`,
    avatar: (
      <CompanyLogo
        storedLogoUrl={c.logo}
        website={c.website}
        linkedinUrl={c.linkedin}
        companyName={c.name}
        size={22}
      />
    ),
  }));
  const industryRows: DeepDiveRow[] = data.industries.map((i) => ({
    key: i.name,
    label: i.name,
    count: i.n,
    href: `/directory?industry=${encodeURIComponent(i.name)}`,
  }));
  const sizeRows: DeepDiveRow[] = sizeBands.map((b) => ({
    key: b.band,
    label: b.label,
    count: b.n,
    href: `/directory?companySizeBand=${b.band}`,
  }));
  const experienceRows: DeepDiveRow[] = expBands.map((b) => ({
    key: b.band,
    label: EXP_BAND_LABELS[b.band] ?? b.band,
    count: b.n,
    href: `/directory?expBand=${b.band}`,
  }));
  const pastEmployerRows: DeepDiveRow[] = data.pastCompanies.map((c) => ({
    key: c.name,
    label: c.name,
    count: c.n,
    // Past employer → search the directory in "ever" scope so the
    // filter actually catches people who worked there in the past.
    href: `/directory?company=${encodeURIComponent(c.name)}&scope=ever`,
    avatar: (
      <CompanyLogo
        storedLogoUrl={c.logo}
        website={c.website}
        linkedinUrl={c.linkedin}
        companyName={c.name}
        size={22}
      />
    ),
  }));
  const stageRows: DeepDiveRow[] = [
    {
      key: "working",
      label: "Working professional",
      count: workingCount,
      href: "/directory",
    },
    {
      key: "student",
      label: "Currently in school",
      count: studentCount,
      href: "/directory",
    },
  ];
  const cityRows: DeepDiveRow[] = cities.map((c) => ({
    key: c.display,
    label: c.display,
    count: c.n,
    href: `/directory?city=${encodeURIComponent(c.filterValue)}`,
  }));
  const regionRows: DeepDiveRow[] = data.regions.map((r) => ({
    key: r.name,
    label: r.name,
    count: r.n,
    href: `/directory?region=${encodeURIComponent(r.name)}`,
  }));

  // ---- Group definitions for the lens UI ----
  const LENSES = [
    { id: "background" as LensId, label: "Background" },
    { id: "location" as LensId, label: "Location" },
    { id: "career" as LensId, label: "Career" },
  ];

  const groupBackground = {
    id: "background" as LensId,
    eyebrow: "Background",
    name: "Education & Origin",
    desc: "Which UWC they attended, where they studied afterwards, where they're originally from, and when they graduated.",
    leadStat: topUwc
      ? `${stripUwc(topUwc.name)} leads · ${origins.length} countries of origin`
      : `${origins.length} countries of origin`,
    chips: [
      `${data.uwcs.length} UWCs`,
      `${data.universities.length} universities`,
      `${origins.length} countries`,
      `${data.decadesRaw.length} decades`,
    ],
    cols: 2,
    facets: [
      { icon: "globe" as IconName, title: "UWC attended", total: data.uwcs.length, rows: uwcRows },
      { icon: "graduation-cap" as IconName, title: "University", total: data.universities.length, rows: universityRows },
      { icon: "globe" as IconName, title: "Country of origin", total: origins.length, rows: originRows },
      { icon: "graduation-cap" as IconName, title: "UWC graduation decade", total: data.decadesRaw.length, rows: decadeRows },
    ],
  };

  const groupLocation = {
    id: "location" as LensId,
    eyebrow: "Location",
    name: "Where they live",
    desc: "Where Bay Area alumni are concentrated — by city and by region.",
    leadStat: topCity
      ? `${topCity.n} in ${topCity.display} · across the Bay & beyond`
      : "Across the Bay & beyond",
    chips: [
      `${cities.length} cities`,
      `${data.regions.length} regions`,
    ],
    cols: 2,
    facets: [
      { icon: "map-pin" as IconName, title: "City", total: cities.length, rows: cityRows },
      { icon: "map-pin" as IconName, title: "Region", total: data.regions.length, rows: regionRows },
    ],
  };

  const topCompanyName = data.companies[0]?.name;
  const groupCareer = {
    id: "career" as LensId,
    eyebrow: "Career",
    name: "Work",
    desc: "Where alumni work now, in what industries, at what scale and seniority — plus where they've been.",
    leadStat: topCompanyName
      ? `${workingCount} working professionals · ${topCompanyName} leads`
      : `${workingCount} working professionals`,
    chips: ["Employers", "Industry", "Size", "Experience", "Past roles", "Stage"],
    cols: 3,
    facets: [
      { icon: "building" as IconName, title: "Where alumni work now", total: data.companies.length, rows: workNowRows },
      { icon: "briefcase" as IconName, title: "Industry", total: data.industries.length, rows: industryRows },
      { icon: "bar-chart" as IconName, title: "Company size", total: sizeBands.length, rows: sizeRows },
      { icon: "clock" as IconName, title: "Experience", total: expBands.length, rows: experienceRows },
      { icon: "history" as IconName, title: "Past employers", total: data.pastCompanies.length, rows: pastEmployerRows },
      { icon: "users" as IconName, title: "Stage", total: stageRows.length, rows: stageRows },
    ],
  };

  const GROUPS = {
    background: groupBackground,
    location: groupLocation,
    career: groupCareer,
  } as const;

  const activeGroup = lens ? GROUPS[lens] : null;

  return (
    <section className="max-w-[1180px] mx-auto px-5 sm:px-7 pt-3 pb-8 md:py-8">
      {activeGroup ? (
        <>
          {/* Breadcrumb shown only on the drill-down view. */}
          <div className="mb-3 text-[13px] text-white/[.62] flex items-center gap-2">
            <Link
              href="/directory/snapshot"
              className="text-white/[.82] hover:text-white inline-flex items-center gap-[6px]"
            >
              <Icon name="arrow-left" size={14} strokeWidth={2} />
              Snapshot
            </Link>
            <span className="opacity-50">/</span>
            <span className="text-white font-semibold">{activeGroup.name}</span>
          </div>

          {/* Group header — title + desc on the left, lens switcher right. */}
          <div className="flex items-end justify-between gap-6 mb-6 flex-wrap">
            <div className="min-w-0">
              <h1
                className="text-white font-extrabold leading-[1] tracking-[-0.02em] m-0"
                style={{
                  fontFamily: "Fraunces, Georgia, serif",
                  fontSize: "clamp(30px, 5.5vw, 38px)",
                }}
              >
                {activeGroup.name}
              </h1>
              <p className="mt-2 text-[15px] text-white/[.74] max-w-[560px] leading-[1.5]">
                {activeGroup.desc}
              </p>
            </div>
            <SnapshotLensSwitcher lenses={LENSES} active={activeGroup.id} />
          </div>

          <div
            className="grid gap-[18px]"
            style={{
              gridTemplateColumns: `repeat(${activeGroup.cols}, minmax(0, 1fr))`,
            }}
          >
            {activeGroup.facets.map((f) => (
              <DeepDiveFacetCard
                key={f.title}
                icon={f.icon}
                title={f.title}
                total={f.total}
                rows={f.rows}
              />
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="mb-6">
            <h1
              className="text-white font-extrabold leading-[1] tracking-[-0.02em]"
              style={{
                fontFamily: "Fraunces, Georgia, serif",
                fontSize: "clamp(30px, 5.5vw, 38px)",
              }}
            >
              Snapshot
            </h1>
            <p className="mt-[10px] text-[15px] text-white/75 max-w-[68ch]">
              Where the {data.totalAlumni} Bay Area alumni cluster — the
              headline numbers first, then dive deeper by area. Every tile
              opens the directory, pre-filtered.
            </p>
          </div>

          {/* Headline image tiles — 4 across desktop, 2 across phone. */}
          {topUwc && topCohort && topCity && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-[14px] mb-8">
              <SnapshotTile
                href={`/directory?college=${encodeURIComponent(topUwc.name)}`}
                eyebrow="Most-represented"
                headline={stripUwc(topUwc.name)}
                label={`UWC · ${topUwc.n} alumni`}
                imageUrl={topUwc.campus}
                fallbackIcon="graduation-cap"
              />
              <SnapshotTile
                href={`/directory?yearFrom=${topCohort.decade_start}&yearTo=${topCohort.decade_start + 9}`}
                eyebrow="Biggest cohort"
                headline={topCohort.decade}
                label={`${topCohort.n} alumni graduated`}
                imageUrl="https://hxdqmbnanbxucbqd.public.blob.vercel-storage.com/events/uploads/7767d11e-41d0-4cd4-b77b-25ddfff9e597-rOmioX3oLBpspwH2wzJ0k6ABeMaJU5.jpg"
                fallbackIcon="calendar"
              />
              <SnapshotTile
                href={`/directory?city=${encodeURIComponent(topCity.filterValue)}`}
                eyebrow="Where most live"
                headline={topCity.display}
                label={`${topCity.n} alumni here`}
                imageUrl="https://hxdqmbnanbxucbqd.public.blob.vercel-storage.com/events/34/photos/1777478401653-nr08mr.jpg"
                fallbackIcon="map-pin"
              />
              <SnapshotTile
                href="/directory/snapshot?lens=background#origin"
                eyebrow="Origins"
                headline={`${totalCountries} countries`}
                label="across the globe"
                imageUrl="/snapshot/world.png"
                fallbackIcon="globe"
              />
            </div>
          )}

          {/* Deep-dive divider + 3 nav cards. */}
          <div className="flex items-center gap-[14px] mt-[6px] mb-4">
            <span className="text-[11px] font-extrabold tracking-[.2em] uppercase text-white/60 whitespace-nowrap">
              Deep dive
            </span>
            <div className="flex-1 h-px bg-white/[.18]" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-[14px]">
            <DeepDiveNavCard
              href="/directory/snapshot?lens=background"
              eyebrow={groupBackground.eyebrow}
              name={groupBackground.name}
              leadStat={groupBackground.leadStat}
              chips={groupBackground.chips}
            />
            <DeepDiveNavCard
              href="/directory/snapshot?lens=location"
              eyebrow={groupLocation.eyebrow}
              name={groupLocation.name}
              leadStat={groupLocation.leadStat}
              chips={groupLocation.chips}
            />
            <DeepDiveNavCard
              href="/directory/snapshot?lens=career"
              eyebrow={groupCareer.eyebrow}
              name={groupCareer.name}
              leadStat={groupCareer.leadStat}
              chips={groupCareer.chips}
            />
          </div>
        </>
      )}
    </section>
  );
}
