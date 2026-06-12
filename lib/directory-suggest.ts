/**
 * Server-side aggregates feeding the chip popovers in the directory
 * search and the stats cluster above it.
 *
 * Each suggestion list is the top ~30 most-frequent values across
 * active alumni (the same active-alumni predicate that the rest of
 * the directory uses). Returned as plain string[] for easy
 * serialization down to the client search component.
 */

import { sql } from "./db";
import { extractCountryCodes } from "./country-flag";

export async function getCompanySuggestions(limit = 30): Promise<string[]> {
  // Top employers across both current and past roles, summed.
  const rows = (await sql`
    SELECT name, SUM(n)::int AS total FROM (
      SELECT current_company AS name, COUNT(*)::int AS n
      FROM alumni
      WHERE current_company IS NOT NULL
        AND affiliation ILIKE '%alum%'
        AND deceased IS NOT TRUE
        AND moved_out IS NOT TRUE
      GROUP BY current_company
      UNION ALL
      SELECT c.company AS name, COUNT(*)::int AS n
      FROM alumni_career c
      JOIN alumni a ON a.id = c.alumni_id
      WHERE c.company IS NOT NULL
        AND a.affiliation ILIKE '%alum%'
        AND a.deceased IS NOT TRUE
        AND a.moved_out IS NOT TRUE
      GROUP BY c.company
    ) u
    WHERE name <> ''
      -- Skip schools that leak into the company list (Minerva
      -- University, Stanford University, UC Berkeley, etc.).
      -- Universities live behind the dedicated University chip.
      AND name NOT ILIKE '%university%'
      AND name NOT ILIKE '%college%'
    GROUP BY name
    ORDER BY total DESC
    LIMIT ${limit}
  `) as Array<{ name: string }>;
  return rows.map((r) => r.name);
}

export async function getCitySuggestions(limit = 30): Promise<string[]> {
  const rows = (await sql`
    SELECT current_city AS name, COUNT(*)::int AS n
    FROM alumni
    WHERE current_city IS NOT NULL
      AND affiliation ILIKE '%alum%'
      AND deceased IS NOT TRUE AND moved_out IS NOT TRUE
    GROUP BY current_city
    ORDER BY n DESC
    LIMIT ${limit}
  `) as Array<{ name: string }>;
  return rows.map((r) => r.name);
}

export async function getCountrySuggestions(limit = 30): Promise<string[]> {
  // alumni.origin is free-text ("Norway / Sweden", "USA (CA)"), so
  // the simplest signal is "top N raw strings" — the chip popover
  // surfaces these as quick picks, and the filter still does
  // substring matching against the origin column.
  const rows = (await sql`
    SELECT origin AS name, COUNT(*)::int AS n
    FROM alumni
    WHERE origin IS NOT NULL
      AND affiliation ILIKE '%alum%'
      AND deceased IS NOT TRUE AND moved_out IS NOT TRUE
    GROUP BY origin
    ORDER BY n DESC
    LIMIT ${limit}
  `) as Array<{ name: string }>;
  return rows.map((r) => r.name);
}

export async function getUniversitySuggestions(limit = 30): Promise<string[]> {
  const rows = (await sql`
    SELECT school AS name, COUNT(*)::int AS n
    FROM alumni_education
    WHERE school IS NOT NULL AND is_uwc IS NOT TRUE
    GROUP BY school
    ORDER BY n DESC
    LIMIT ${limit}
  `) as Array<{ name: string }>;
  return rows.map((r) => r.name);
}

export async function getIndustrySuggestions(
  limit = 60,
): Promise<Array<{ value: string; count: number }>> {
  const rows = (await sql`
    SELECT current_company_industry AS value, COUNT(*)::int AS count
    FROM alumni
    WHERE current_company_industry IS NOT NULL
      AND affiliation ILIKE '%alum%'
      AND deceased IS NOT TRUE
      AND moved_out IS NOT TRUE
    GROUP BY current_company_industry
    ORDER BY count DESC, current_company_industry ASC
    LIMIT ${limit}
  `) as Array<{ value: string; count: number }>;
  return rows;
}

export type DirectorySuggestData = {
  companies: string[];
  cities: string[];
  countries: string[];
  universities: string[];
  industries: Array<{ value: string; count: number }>;
};

export async function getDirectorySuggestData(): Promise<DirectorySuggestData> {
  const [companies, cities, countries, universities, industries] =
    await Promise.all([
      getCompanySuggestions(),
      getCitySuggestions(),
      getCountrySuggestions(),
      getUniversitySuggestions(),
      getIndustrySuggestions(),
    ]);
  return { companies, cities, countries, universities, industries };
}

/** Three-number cluster above the search. "Countries" parses the
 * messy origin strings via extractCountryCodes so we count distinct
 * ISO codes — closer to truth than counting raw origin values. */
export async function getDirectoryStats(): Promise<{
  alumni: number;
  countries: number;
  colleges: number;
}> {
  const totals = (await sql`
    SELECT
      COUNT(*)::int                                            AS alumni,
      COUNT(DISTINCT uwc_college)
        FILTER (WHERE uwc_college IS NOT NULL)::int            AS colleges
    FROM alumni
    WHERE affiliation ILIKE '%alum%'
      AND deceased IS NOT TRUE
      AND moved_out IS NOT TRUE
  `) as Array<{ alumni: number; colleges: number }>;

  const origins = (await sql`
    SELECT DISTINCT origin
    FROM alumni
    WHERE origin IS NOT NULL
      AND affiliation ILIKE '%alum%'
      AND deceased IS NOT TRUE
      AND moved_out IS NOT TRUE
  `) as Array<{ origin: string | null }>;

  const isos = new Set<string>();
  for (const r of origins) {
    for (const iso of extractCountryCodes(r.origin)) {
      isos.add(iso);
    }
  }

  return {
    alumni: totals[0]?.alumni ?? 0,
    colleges: totals[0]?.colleges ?? 0,
    countries: isos.size,
  };
}
