import { sql } from "./db";

/**
 * Read-only query layer for the /directory surface. Mirrors the spirit
 * of lib/alumni-query.ts but is intentionally NARROWER:
 *
 * - SELECTs only fields that are safe to show a non-admin (no email,
 *   no mobile, no user-entered `about` / `questions` / `working` /
 *   `studying` / `help_tags`).
 * - WHERE clauses only allow filters on directory-safe columns
 *   (subscription / engagement / followup / verification etc. simply
 *   aren't recognized).
 * - Broad keyword search scans first/last name, current job/title/
 *   industry, headline, LinkedIn-enriched bio, past careers, current
 *   city, location_full, AND alumni_education (school + degree field)
 *   — but never email/about/help_tags.
 * - Always restricts to Alum affiliation (Friends and Parents-of are
 *   hidden by design — directory is for peer-alumni LinkedIn
 *   connections).
 * - Always hides deceased and moved-out rows.
 *
 * This module is the auditable surface: if it doesn't appear here, it
 * can't show up on /directory.
 */

export type DirectoryExpBand = "0-3" | "3-7" | "7-15" | "15+";

export type DirectoryCompanySizeBand =
  | "startup"
  | "small"
  | "mid"
  | "large"
  | "enterprise";
const DIR_SIZE_BANDS: Record<DirectoryCompanySizeBand, string[]> = {
  startup: ["1-10", "11-50"],
  small: ["51-200", "201-500"],
  mid: ["501-1000", "1001-5000"],
  large: ["5001-10000"],
  enterprise: ["10001+"],
};

export type DirectoryFilters = {
  /** Broad free-text search across name + role + bio + past careers + education. */
  q?: string;
  /** Prefix-match against first/last name (the "Name" box). */
  name?: string;
  college?: string;
  region?: string;
  origin?: string;
  yearFrom?: number;
  yearTo?: number;
  industries?: string[];
  industryGroup?: string;
  industry?: string; // specific current_company_industry single-select
  city?: string;
  company?: string;
  university?: string;
  expBand?: DirectoryExpBand;
  companySizeBand?: DirectoryCompanySizeBand;
  /** When true, the `industry` / `industries` filter also matches past
   * roles via alumni_career.company_industry. Off by default (current
   * company only). */
  industriesIncludePast?: boolean;
};

export type DirectoryAlumnusRow = {
  id: number;
  first_name: string | null;
  last_name: string | null;
  uwc_college: string | null;
  grad_year: number | null;
  current_city: string | null;
  region: string | null;
  origin: string | null;
  // LinkedIn-enrichment fields are the "public" face — same data the
  // person publishes on their own LinkedIn profile.
  photo_url: string | null;
  headline: string | null;
  linkedin_about: string | null;
  linkedin_url: string | null;
  current_title: string | null;
  current_company: string | null;
  current_company_industry: string | null;
  current_company_size: string | null;
  location_full: string | null;
};

export type DirectoryCareerRow = {
  alumni_id: number;
  position: number | null;
  company: string | null;
  company_industry: string | null;
  company_size: string | null;
  company_linkedin_url: string | null;
  location: string | null;
  title: string | null;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean | null;
};

const SELECT_DIRECTORY_FIELDS = `
  id, first_name, last_name, uwc_college, grad_year,
  current_city, region, origin,
  photo_url, headline, linkedin_about, linkedin_url,
  current_title, current_company, current_company_industry,
  current_company_size, location_full
`;

function buildWhere(f: DirectoryFilters): { where: string; params: unknown[] } {
  const parts: string[] = [];
  const params: unknown[] = [];

  const push = (build: (n: number) => string, value: unknown) => {
    params.push(value);
    parts.push(build(params.length));
  };

  // Hard-coded directory-scope filters: alumni only, alive, present.
  parts.push(`(affiliation ILIKE '%alum%')`);
  parts.push(`(deceased IS NOT TRUE)`);
  parts.push(`(moved_out IS NOT TRUE)`);

  // Name box — prefix match on first/last.
  if (f.name) {
    const tokens = f.name.toLowerCase().split(/\s+/).map((t) => t.trim()).filter(Boolean);
    if (tokens.length === 1) {
      const t = `${tokens[0]}%`;
      params.push(t);
      params.push(t);
      const i = params.length;
      parts.push(
        `(lower(first_name) LIKE $${i - 1} OR lower(last_name) LIKE $${i})`,
      );
    } else if (tokens.length >= 2) {
      const first = `${tokens[0]}%`;
      const last = `${tokens[tokens.length - 1]}%`;
      params.push(first);
      params.push(last);
      const i = params.length;
      parts.push(
        `(lower(first_name) LIKE $${i - 1} AND lower(last_name) LIKE $${i})`,
      );
    }
  }

  // Broad search — directory-safe columns + child tables.
  if (f.q) {
    const q = `%${f.q.toLowerCase()}%`;
    params.push(q);
    const qIdx = params.length;
    parts.push(`(
      lower(first_name) LIKE $${qIdx} OR lower(last_name) LIKE $${qIdx}
      OR lower(coalesce(current_title, '')) LIKE $${qIdx}
      OR lower(coalesce(current_company, '')) LIKE $${qIdx}
      OR lower(coalesce(current_company_industry, '')) LIKE $${qIdx}
      OR lower(coalesce(headline, '')) LIKE $${qIdx}
      OR lower(coalesce(linkedin_about, '')) LIKE $${qIdx}
      OR lower(coalesce(current_city, '')) LIKE $${qIdx}
      OR lower(coalesce(location_full, '')) LIKE $${qIdx}
      OR EXISTS (
        SELECT 1 FROM alumni_career c
        WHERE c.alumni_id = alumni.id
          AND (lower(coalesce(c.company,'')) LIKE $${qIdx}
            OR lower(coalesce(c.title,'')) LIKE $${qIdx}
            OR lower(coalesce(c.company_industry,'')) LIKE $${qIdx})
      )
      OR EXISTS (
        SELECT 1 FROM alumni_education e
        WHERE e.alumni_id = alumni.id
          AND (lower(coalesce(e.school,'')) LIKE $${qIdx}
            OR lower(coalesce(e.degree_field,'')) LIKE $${qIdx})
      )
    )`);
  }

  if (f.college) push((n) => `uwc_college = $${n}`, f.college);
  if (f.region) push((n) => `region = $${n}`, f.region);
  if (f.origin)
    push((n) => `lower(coalesce(origin,'')) LIKE $${n}`, `%${f.origin.toLowerCase()}%`);
  if (f.yearFrom != null) push((n) => `grad_year >= $${n}`, f.yearFrom);
  if (f.yearTo != null) push((n) => `grad_year <= $${n}`, f.yearTo);

  // Industry filter — optionally extends to past roles via alumni_career.
  // Single `industry` and multi-select `industries` follow the same scope.
  const industryValues = f.industries && f.industries.length > 0
    ? f.industries
    : f.industry
      ? [f.industry]
      : [];
  if (industryValues.length > 0) {
    params.push(industryValues);
    const idx = params.length;
    if (f.industriesIncludePast) {
      parts.push(`(current_company_industry = ANY($${idx})
        OR EXISTS (SELECT 1 FROM alumni_career c
                   WHERE c.alumni_id = alumni.id
                     AND c.company_industry = ANY($${idx})))`);
    } else {
      parts.push(`current_company_industry = ANY($${idx})`);
    }
  }
  if (f.companySizeBand) {
    const sizes = DIR_SIZE_BANDS[f.companySizeBand];
    push((n) => `current_company_size = ANY($${n})`, sizes);
  }
  if (f.city) {
    push(
      (n) => `lower(coalesce(current_city,'')) LIKE $${n}`,
      `%${f.city.toLowerCase()}%`,
    );
  }
  if (f.expBand === "0-3") {
    parts.push(
      `(total_experience_years IS NOT NULL AND total_experience_years::numeric < 3)`,
    );
  } else if (f.expBand === "3-7") {
    parts.push(
      `(total_experience_years::numeric >= 3 AND total_experience_years::numeric < 7)`,
    );
  } else if (f.expBand === "7-15") {
    parts.push(
      `(total_experience_years::numeric >= 7 AND total_experience_years::numeric < 15)`,
    );
  } else if (f.expBand === "15+") {
    parts.push(`(total_experience_years::numeric >= 15)`);
  }
  if (f.company) {
    push(
      (n) => `lower(coalesce(current_company,'')) LIKE $${n}`,
      `%${f.company.toLowerCase()}%`,
    );
  }
  if (f.university) {
    push(
      (n) =>
        `EXISTS (SELECT 1 FROM alumni_education e WHERE e.alumni_id = alumni.id AND e.is_uwc IS NOT TRUE AND lower(coalesce(e.school,'')) LIKE $${n})`,
      `%${f.university.toLowerCase()}%`,
    );
  }

  const where = parts.length > 0 ? `WHERE ${parts.join(" AND ")}` : "";
  return { where, params };
}

export async function searchDirectoryAlumni(
  f: DirectoryFilters,
  limit = 500,
): Promise<DirectoryAlumnusRow[]> {
  const { where, params } = buildWhere(f);
  const rows = (await sql.query(
    `SELECT ${SELECT_DIRECTORY_FIELDS}
       FROM alumni
       ${where}
       ORDER BY enriched_at DESC NULLS LAST, last_name ASC, first_name ASC
       LIMIT ${limit}`,
    params,
  )) as DirectoryAlumnusRow[];
  return rows;
}

export async function countDirectoryAlumni(f: DirectoryFilters): Promise<number> {
  const { where, params } = buildWhere(f);
  const rows = (await sql.query(
    `SELECT COUNT(*)::int AS n FROM alumni ${where}`,
    params,
  )) as { n: number }[];
  return rows[0]?.n ?? 0;
}

export async function getDirectoryAlumnus(
  id: number,
): Promise<DirectoryAlumnusRow | null> {
  const rows = (await sql.query(
    `SELECT ${SELECT_DIRECTORY_FIELDS}
       FROM alumni
       WHERE id = $1
         AND affiliation ILIKE '%alum%'
         AND deceased IS NOT TRUE
         AND moved_out IS NOT TRUE
       LIMIT 1`,
    [id],
  )) as DirectoryAlumnusRow[];
  return rows[0] ?? null;
}

export async function getDirectoryCareers(
  alumniId: number,
): Promise<DirectoryCareerRow[]> {
  const rows = (await sql.query(
    `SELECT alumni_id, position, company, company_industry, company_size, company_linkedin_url,
            location, title, start_date, end_date, is_current
       FROM alumni_career
       WHERE alumni_id = $1
       ORDER BY is_current DESC NULLS LAST, position ASC NULLS LAST,
                end_date DESC NULLS FIRST, start_date DESC NULLS LAST`,
    [alumniId],
  )) as DirectoryCareerRow[];
  return rows;
}

/* ---------------------- Audit logging ---------------------- */

export async function logDirectorySearch(
  session_id: string,
  filters: DirectoryFilters,
  directory_user_id: number | null = null,
): Promise<void> {
  await sql`
    INSERT INTO directory_views (session_id, action, query_json, directory_user_id)
    VALUES (${session_id}, 'search', ${JSON.stringify(filters)}::jsonb, ${directory_user_id})
  `;
}

export async function logDirectoryProfileView(
  session_id: string,
  alumni_id: number,
  directory_user_id: number | null = null,
): Promise<void> {
  await sql`
    INSERT INTO directory_views (session_id, action, target_id, directory_user_id)
    VALUES (${session_id}, 'profile_view', ${alumni_id}, ${directory_user_id})
  `;
}
