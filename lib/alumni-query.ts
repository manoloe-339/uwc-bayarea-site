import { sql } from "./db";

export type SubscriptionFilter = "subscribed" | "unsubscribed" | "any";

export type AlumniFilters = {
  q?: string;
  college?: string;
  origin?: string;
  city?: string;
  region?: string;
  yearFrom?: number;
  yearTo?: number;
  help?: string;
  includeNonAlums?: boolean;
  includeMovedOut?: boolean;
  subscription?: SubscriptionFilter;
};

export type AlumniRow = {
  id: number;
  first_name: string | null;
  last_name: string | null;
  email: string;
  mobile: string | null;
  origin: string | null;
  uwc_college: string | null;
  grad_year: number | null;
  current_city: string | null;
  region: string | null;
  affiliation: string | null;
  company: string | null;
  help_tags: string | null;
  national_committee: string | null;
  about: string | null;
  questions: string | null;
  studying: string | null;
  working: string | null;
  subscribed: boolean | null;
  sources: string[] | null;
  flags: string[];
};

export function buildWhere(f: AlumniFilters): { where: string; params: unknown[] } {
  const parts: string[] = [];
  const params: unknown[] = [];

  const push = (build: (n: number) => string, value: unknown) => {
    params.push(value);
    parts.push(build(params.length));
  };

  if (f.q) {
    const q = `%${f.q.toLowerCase()}%`;
    push(
      (n) =>
        `(lower(first_name) LIKE $${n} OR lower(last_name) LIKE $${n} OR lower(current_city) LIKE $${n} OR lower(about) LIKE $${n} OR lower(working) LIKE $${n} OR lower(studying) LIKE $${n} OR lower(help_tags) LIKE $${n} OR lower(company) LIKE $${n})`,
      q
    );
  }
  if (f.college) push((n) => `uwc_college = $${n}`, f.college);
  if (f.region) push((n) => `region = $${n}`, f.region);
  if (f.origin) push((n) => `lower(origin) LIKE $${n}`, `%${f.origin.toLowerCase()}%`);
  if (f.city) push((n) => `lower(current_city) LIKE $${n}`, `%${f.city.toLowerCase()}%`);
  if (!f.includeNonAlums) {
    parts.push(`(affiliation IS NULL OR affiliation ILIKE '%alum%')`);
  }
  if (!f.includeMovedOut) {
    parts.push(`(moved_out IS NOT TRUE)`);
  }
  if (f.subscription === "unsubscribed") {
    parts.push(`subscribed = FALSE`);
  } else if (f.subscription !== "any") {
    // default: subscribed only
    parts.push(`subscribed IS NOT FALSE`);
  }
  if (typeof f.yearFrom === "number") push((n) => `grad_year >= $${n}`, f.yearFrom);
  if (typeof f.yearTo === "number") push((n) => `grad_year <= $${n}`, f.yearTo);
  if (f.help) push((n) => `lower(help_tags) LIKE $${n}`, `%${f.help.toLowerCase()}%`);

  const where = parts.length > 0 ? `WHERE ${parts.join(" AND ")}` : "";
  return { where, params };
}

export async function searchAlumni(f: AlumniFilters, limit = 500): Promise<AlumniRow[]> {
  const { where, params } = buildWhere(f);
  const query = `
    SELECT id, first_name, last_name, email, mobile, origin, uwc_college,
           grad_year, current_city, region, affiliation, company, help_tags,
           national_committee, about, questions, studying, working, subscribed,
           sources, flags
    FROM alumni
    ${where}
    ORDER BY grad_year DESC NULLS LAST, last_name ASC NULLS LAST, first_name ASC NULLS LAST
    LIMIT ${limit}
  `;
  const rows = await sql.query(query, params);
  return rows as AlumniRow[];
}

export async function countAlumni(f: AlumniFilters): Promise<number> {
  const { where, params } = buildWhere(f);
  const rows = await sql.query(`SELECT COUNT(*)::int AS n FROM alumni ${where}`, params);
  return (rows[0] as { n: number }).n;
}
