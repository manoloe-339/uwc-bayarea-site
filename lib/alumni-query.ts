import { sql } from "./db";

export type SubscriptionFilter = "subscribed" | "unsubscribed" | "any";
export type EngagementFilter =
  | "opened_any"
  | "clicked_any"
  | "never_opened"
  | "never_received";

export type ExperienceBand = "0-3" | "3-7" | "7-15" | "15+";
export type UwcVerifiedFilter = "verified" | "unverified" | "any";

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
  engagement?: EngagementFilter;

  // LinkedIn-enrichment filters
  industries?: string[];         // any-of match against current_company_industry
  company?: string;              // typeahead input; matches id first, else ILIKE name
  companyIdMap?: Record<string, string>; // page-provided: normalized name → current_company_id for exact-match lookup
  expBand?: ExperienceBand;
  uwcVerified?: UwcVerifiedFilter;
  hasPhoto?: boolean;

  /** Explicit recipient IDs (bypasses other filters during send). */
  ids?: number[];
};

export type AlumniRow = {
  id: number;
  first_name: string | null;
  last_name: string | null;
  email: string;
  mobile: string | null;
  linkedin_url: string | null;
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
  // LinkedIn enrichment — surfaced in the search grid + detail page
  headline: string | null;
  photo_url: string | null;
  current_title: string | null;
  current_company: string | null;
  current_company_industry: string | null;
  uwc_verified: boolean | null;
  total_experience_years: string | number | null;
  location_city: string | null;
  location_country: string | null;
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
  if (f.engagement === "opened_any") {
    parts.push(
      `EXISTS (SELECT 1 FROM email_sends WHERE alumni_id = alumni.id AND opened_at IS NOT NULL)`
    );
  } else if (f.engagement === "clicked_any") {
    parts.push(
      `EXISTS (SELECT 1 FROM email_sends WHERE alumni_id = alumni.id AND clicked_at IS NOT NULL)`
    );
  } else if (f.engagement === "never_opened") {
    parts.push(
      `EXISTS (SELECT 1 FROM email_sends WHERE alumni_id = alumni.id AND status = 'sent') AND NOT EXISTS (SELECT 1 FROM email_sends WHERE alumni_id = alumni.id AND opened_at IS NOT NULL)`
    );
  } else if (f.engagement === "never_received") {
    parts.push(`NOT EXISTS (SELECT 1 FROM email_sends WHERE alumni_id = alumni.id)`);
  }
  if (typeof f.yearFrom === "number") push((n) => `grad_year >= $${n}`, f.yearFrom);
  if (typeof f.yearTo === "number") push((n) => `grad_year <= $${n}`, f.yearTo);
  if (f.help) push((n) => `lower(help_tags) LIKE $${n}`, `%${f.help.toLowerCase()}%`);

  // Industry multi-select (any-of)
  if (f.industries && f.industries.length > 0) {
    push((n) => `current_company_industry = ANY($${n})`, f.industries);
  }

  // Company: exact-id match when the typed string resolves to a known company
  // id, otherwise ILIKE match on the display name.
  if (f.company && f.company.trim()) {
    const q = f.company.trim();
    const idFromMap = f.companyIdMap?.[q.toLowerCase()];
    if (idFromMap) {
      push((n) => `current_company_id = $${n}`, idFromMap);
    } else {
      push((n) => `current_company ILIKE $${n}`, `%${q}%`);
    }
  }

  // Experience band
  if (f.expBand === "0-3") {
    parts.push(`(total_experience_years IS NOT NULL AND total_experience_years < 3)`);
  } else if (f.expBand === "3-7") {
    parts.push(`(total_experience_years >= 3 AND total_experience_years < 7)`);
  } else if (f.expBand === "7-15") {
    parts.push(`(total_experience_years >= 7 AND total_experience_years < 15)`);
  } else if (f.expBand === "15+") {
    parts.push(`(total_experience_years >= 15)`);
  }

  // UWC verified filter
  if (f.uwcVerified === "verified") {
    parts.push(`uwc_verified = TRUE`);
  } else if (f.uwcVerified === "unverified") {
    // Unverified ⇒ we did enrich them (enriched_at set) but UWC didn't appear.
    // Don't show never-enriched rows here; that's not the same category.
    parts.push(`(uwc_verified IS NOT TRUE AND enriched_at IS NOT NULL)`);
  }

  // Has photo
  if (f.hasPhoto) {
    parts.push(`photo_url IS NOT NULL`);
  }

  const where = parts.length > 0 ? `WHERE ${parts.join(" AND ")}` : "";
  return { where, params };
}

export async function searchAlumni(f: AlumniFilters, limit = 500): Promise<AlumniRow[]> {
  const { where, params } = buildWhere(f);
  const query = `
    SELECT id, first_name, last_name, email, mobile, linkedin_url, origin,
           uwc_college, grad_year, current_city, region, affiliation, company,
           help_tags, national_committee, about, questions, studying, working,
           subscribed, sources, flags
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

export async function getAlumniByIds(ids: number[]): Promise<AlumniRow[]> {
  if (ids.length === 0) return [];
  const rows = await sql.query(
    `SELECT id, first_name, last_name, email, mobile, linkedin_url, origin,
            uwc_college, grad_year, current_city, region, affiliation, company,
            help_tags, national_committee, about, questions, studying, working,
            subscribed, sources, flags,
            headline, photo_url, current_title, current_company,
            current_company_industry, uwc_verified, total_experience_years,
            location_city, location_country
     FROM alumni
     WHERE id = ANY($1) AND subscribed IS NOT FALSE
     ORDER BY last_name ASC NULLS LAST, first_name ASC NULLS LAST`,
    [ids]
  );
  return rows as AlumniRow[];
}
