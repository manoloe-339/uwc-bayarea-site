import { sql } from "./db";
import { industriesInGroup, type IndustryGroup } from "./industry-groups";

export type SubscriptionFilter = "subscribed" | "unsubscribed" | "any";
export type EngagementFilter =
  | "opened_any"
  | "clicked_any"
  | "never_opened"
  | "never_received";

export type ExperienceBand = "0-3" | "3-7" | "7-15" | "15+";
export type UwcVerifiedFilter = "verified" | "unverified" | "any";
export type LinkedinFilter = "has" | "missing" | "missing_unverified" | "missing_confirmed";
export type CompanySizeBand = "startup" | "large";
const COMPANY_SIZE_BANDS: Record<CompanySizeBand, string[]> = {
  startup: ["1-10", "11-50", "51-200"],
  large: ["1001-5000", "5001-10000", "10001+"],
};
export type CompanyTagFilter = "tech" | "non_tech" | "startup" | "not_startup";
export const FOLLOWUP_REASONS = ["bad_record", "follow_up", "invite", "ask_for_help", "other"] as const;
export type FollowupReason = (typeof FOLLOWUP_REASONS)[number];
export const FOLLOWUP_REASON_LABELS: Record<FollowupReason, string> = {
  bad_record: "Bad record",
  follow_up: "Follow up",
  invite: "Invite",
  ask_for_help: "Ask for help",
  other: "Other",
};
export type FollowupFilter = "any" | "none" | FollowupReason;

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
  industryGroup?: IndustryGroup; // grouped category; expands to industries[] at query time
  company?: string;              // typeahead input; matches id first, else ILIKE name
  companyIdMap?: Record<string, string>; // page-provided: normalized name → current_company_id for exact-match lookup
  expBand?: ExperienceBand;
  uwcVerified?: UwcVerifiedFilter;
  hasPhoto?: boolean;
  linkedin?: LinkedinFilter;
  followup?: FollowupFilter;
  companySizeBand?: CompanySizeBand;
  /** Matches non-UWC education rows (undergrad / grad school). ILIKE search. */
  university?: string;
  /** Classification-backed tech / startup filter (requires a company_classifications row). */
  companyTag?: CompanyTagFilter;
  /** Classification-backed sector filter (ai_research, fintech, biotech_research, etc.). */
  sector?: string;

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
  location_full: string | null;
  linkedin_about: string | null;
  linkedin_alternate_email: string | null;
  followup_reason: string | null;
  enriched_at: string | null;
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
    // Broad fuzzy search: every text field on alumni plus the child tables
    // (career history, education, volunteering). Lets a single term find
    // matches across self-reported and LinkedIn-enriched surfaces at once.
    push(
      (n) =>
        `(
          lower(first_name) LIKE $${n} OR lower(last_name) LIKE $${n}
          OR lower(current_city) LIKE $${n} OR lower(about) LIKE $${n}
          OR lower(working) LIKE $${n} OR lower(studying) LIKE $${n}
          OR lower(help_tags) LIKE $${n} OR lower(company) LIKE $${n}
          OR lower(questions) LIKE $${n} OR lower(national_committee) LIKE $${n}
          OR lower(origin) LIKE $${n} OR lower(uwc_college) LIKE $${n}
          OR lower(uwc_college_raw) LIKE $${n} OR lower(uwc_school_matched) LIKE $${n}
          OR lower(current_company) LIKE $${n} OR lower(current_title) LIKE $${n}
          OR lower(current_company_industry) LIKE $${n}
          OR lower(current_location) LIKE $${n}
          OR lower(location_full) LIKE $${n} OR lower(location_country) LIKE $${n}
          OR lower(headline) LIKE $${n} OR lower(linkedin_about) LIKE $${n}
          OR lower(linkedin_alternate_email) LIKE $${n}
          OR EXISTS (
            SELECT 1 FROM alumni_career c
            WHERE c.alumni_id = alumni.id
              AND (lower(c.company) LIKE $${n} OR lower(c.title) LIKE $${n})
          )
          OR EXISTS (
            SELECT 1 FROM alumni_education e
            WHERE e.alumni_id = alumni.id
              AND (lower(e.school) LIKE $${n} OR lower(e.degree_field) LIKE $${n})
          )
          OR EXISTS (
            SELECT 1 FROM alumni_volunteering v
            WHERE v.alumni_id = alumni.id
              AND (lower(v.organization) LIKE $${n} OR lower(v.role) LIKE $${n})
          )
        )`,
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

  // Industry group: expand to the list of industries in that bucket.
  if (f.industryGroup) {
    const expanded = industriesInGroup(f.industryGroup);
    if (expanded.length > 0) {
      push((n) => `current_company_industry = ANY($${n})`, expanded);
    }
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

  // LinkedIn URL presence + admin-verified "no LinkedIn" sub-states.
  const missingSql = `(linkedin_url IS NULL OR linkedin_url = '')`;
  if (f.linkedin === "has") {
    parts.push(`(linkedin_url IS NOT NULL AND linkedin_url <> '')`);
  } else if (f.linkedin === "missing") {
    parts.push(missingSql);
  } else if (f.linkedin === "missing_unverified") {
    parts.push(`${missingSql} AND no_linkedin_confirmed IS NOT TRUE`);
  } else if (f.linkedin === "missing_confirmed") {
    parts.push(`${missingSql} AND no_linkedin_confirmed IS TRUE`);
  }

  // Company size band (Phase 3 NL parser maps "startup"/"large" here)
  if (f.companySizeBand) {
    const sizes = COMPANY_SIZE_BANDS[f.companySizeBand];
    push((n) => `current_company_size = ANY($${n})`, sizes);
  }

  // University (non-UWC education) — ILIKE match against alumni_education.school
  if (f.university && f.university.trim()) {
    push(
      (n) =>
        `EXISTS (SELECT 1 FROM alumni_education e WHERE e.alumni_id = alumni.id AND e.is_uwc IS NOT TRUE AND lower(e.school) LIKE $${n})`,
      `%${f.university.toLowerCase().trim()}%`
    );
  }

  // Company classification tag — requires company_classifications row.
  // "tech" / "startup" require a positive classification. "non_tech" /
  // "not_startup" include both negative-classified rows and unclassified
  // rows (no classification = don't silently filter them out).
  if (f.companyTag === "tech") {
    parts.push(
      `EXISTS (SELECT 1 FROM company_classifications cc WHERE cc.company_key = lower(trim(alumni.current_company)) AND cc.is_tech = TRUE)`
    );
  } else if (f.companyTag === "non_tech") {
    parts.push(
      `NOT EXISTS (SELECT 1 FROM company_classifications cc WHERE cc.company_key = lower(trim(alumni.current_company)) AND cc.is_tech = TRUE)`
    );
  } else if (f.companyTag === "startup") {
    parts.push(
      `EXISTS (SELECT 1 FROM company_classifications cc WHERE cc.company_key = lower(trim(alumni.current_company)) AND cc.is_startup = TRUE)`
    );
  } else if (f.companyTag === "not_startup") {
    parts.push(
      `NOT EXISTS (SELECT 1 FROM company_classifications cc WHERE cc.company_key = lower(trim(alumni.current_company)) AND cc.is_startup = TRUE)`
    );
  }

  // Classification-backed sector filter
  if (f.sector && f.sector.trim()) {
    push(
      (n) =>
        `EXISTS (SELECT 1 FROM company_classifications cc WHERE cc.company_key = lower(trim(alumni.current_company)) AND cc.sector = $${n})`,
      f.sector.trim()
    );
  }

  // Follow-up flag (admin)
  if (f.followup === "any") {
    parts.push(`followup_reason IS NOT NULL`);
  } else if (f.followup === "none") {
    parts.push(`followup_reason IS NULL`);
  } else if (f.followup && FOLLOWUP_REASONS.includes(f.followup as FollowupReason)) {
    push((n) => `followup_reason = $${n}`, f.followup);
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
           subscribed, sources, flags,
           headline, photo_url, current_title, current_company,
           current_company_industry, uwc_verified, total_experience_years,
           location_city, location_country, location_full,
           linkedin_about, linkedin_alternate_email,
           followup_reason, enriched_at
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
            location_city, location_country, location_full,
           linkedin_about, linkedin_alternate_email,
           followup_reason, enriched_at
     FROM alumni
     WHERE id = ANY($1) AND subscribed IS NOT FALSE
     ORDER BY last_name ASC NULLS LAST, first_name ASC NULLS LAST`,
    [ids]
  );
  return rows as AlumniRow[];
}
