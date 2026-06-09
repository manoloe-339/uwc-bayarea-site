/**
 * Shapes an Apify profile response into the column patch applied to
 * `alumni` plus the child rows written into `alumni_education`,
 * `alumni_career`, `alumni_volunteering`.
 *
 * All writes go through COALESCE so admin-entered data isn't blanked
 * when LinkedIn returns null for a field. Name columns are never
 * touched — user-provided names stay authoritative per Part A.
 */

import type {
  ApifyEducationEntry,
  ApifyExperienceEntry,
  ApifyProfile,
  ApifyVolunteerEntry,
} from "@/types/enrichment";
import { UWC_PATTERN } from "./constants";

export type AlumniPatch = {
  linkedin_url: string;
  linkedin_alternate_email: string | null;
  headline: string | null;
  about: string | null;
  location_city: string | null;
  location_country: string | null;
  location_full: string | null;
  photo_url: string | null;
  current_title: string | null;
  current_company: string | null;
  current_company_linkedin: string | null;
  current_company_industry: string | null;
  current_company_size: string | null;
  current_company_website: string | null;
  current_company_logo_url: string | null;
  current_location: string | null;
  current_since: string | null;
  total_experience_years: number | null;
  first_role_year: number | null;
  uwc_verified: boolean;
  uwc_school_matched: string | null;
};

export type EducationRow = {
  position: number;
  school: string | null;
  school_id: string | null;
  school_linkedin_url: string | null;
  school_logo_url: string | null;
  degree_field: string | null;
  start_year: number | null;
  end_year: number | null;
  is_uwc: boolean;
};

export type CareerRow = {
  position: number;
  title: string | null;
  company: string | null;
  company_linkedin_url: string | null;
  company_industry: string | null;
  company_size: string | null;
  company_website: string | null;
  company_logo_url: string | null;
  start_date: string | null;
  end_date: string | null;
  location: string | null;
  is_current: boolean;
};

export type VolunteeringRow = {
  organization: string | null;
  role: string | null;
  industry: string | null;
  start_year: number | null;
  end_year: number | null;
  is_current: boolean;
};

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

function normYear(raw: unknown): number | null {
  if (raw == null) return null;
  if (typeof raw === "number") return raw > 0 ? raw : null;
  if (typeof raw === "string") {
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  if (typeof raw === "object") {
    const y = (raw as { year?: number | string | null }).year;
    return normYear(y);
  }
  return null;
}

function blank(v: string | null | undefined): string | null {
  if (v == null) return null;
  const t = v.trim();
  return t ? t : null;
}

/* ------------------------------------------------------------------ */
/* UWC detection                                                      */
/* ------------------------------------------------------------------ */

export function detectUwc(
  educations: ApifyEducationEntry[] | null | undefined
): { verified: boolean; matched: string | null } {
  if (!Array.isArray(educations)) return { verified: false, matched: null };
  for (const e of educations) {
    const blob = `${e.title ?? ""} ${e.subtitle ?? ""} ${e.description ?? ""}`;
    if (UWC_PATTERN.test(blob)) {
      return { verified: true, matched: blank(e.title) };
    }
  }
  return { verified: false, matched: null };
}

/* ------------------------------------------------------------------ */
/* Transformers                                                       */
/* ------------------------------------------------------------------ */

/** Patterns that mark an experience as a non-employment entry — an
 * alumni association, board seat, or other unpaid affiliation.
 *
 * Intentionally narrow: "Fellow", "Member", "Advisor", and "Mentor"
 * on their own are valid job titles (Research Fellow, Member of
 * Technical Staff at OpenAI, Senior Advisor at McKinsey). We only
 * filter when the experience clearly isn't employment:
 *   - title mentions "alumni" explicitly (e.g. Luke Pustejovsky's
 *     "Member I Harvard Alumni for Mental Health");
 *   - title is a board seat ("Board of Directors / Advisors /
 *     Trustees");
 *   - the "company" is the alma mater's LinkedIn /school/ page AND
 *     the title contains an alumni- or membership-marker (so we
 *     don't filter out actual school employees like research
 *     fellows or staff). */
const NON_EMPLOYMENT_TITLE_PATTERNS: RegExp[] = [
  /\balumni\b/i,
  /\bboard of (directors|advisors|trustees|governors)\b/i,
];

const SCHOOL_PAGE_RE = /linkedin\.com\/school\//i;
const SCHOOL_AFFILIATION_TITLE_RE = /\b(alumni|alum|member|chapter)\b/i;

function looksLikeEmployment(exp: ApifyExperienceEntry): boolean {
  const title = exp.title ?? "";
  if (NON_EMPLOYMENT_TITLE_PATTERNS.some((re) => re.test(title))) return false;
  if (
    exp.companyLink1 &&
    SCHOOL_PAGE_RE.test(exp.companyLink1) &&
    SCHOOL_AFFILIATION_TITLE_RE.test(title)
  ) {
    return false;
  }
  return true;
}

/** Pick the "headline" experience for populating alumni.current_*
 * fields. Apify's profile.jobTitle / profile.companyName reflect the
 * top of LinkedIn's experiences list verbatim — but LinkedIn orders
 * by most-recent-start, so a 2024 alumni-group membership outranks a
 * 2020 CEO role. We pick the most-recently-started experience that
 * looks like real employment (filtering out members, advisors, etc).
 * Falls back to the first experience when nothing passes the filter. */
function pickHeadlineExperience(
  profile: ApifyProfile,
): ApifyExperienceEntry | null {
  if (!Array.isArray(profile.experiences) || profile.experiences.length === 0) {
    return null;
  }
  const currents = profile.experiences.filter(
    (e) => e.jobStillWorking === true,
  );
  const pool = currents.length > 0 ? currents : profile.experiences;
  const real = pool.filter(looksLikeEmployment);
  // First entry in each pool is the most-recently-started (LinkedIn's
  // own ordering). No date parsing needed.
  return real[0] ?? pool[0] ?? null;
}

function findCurrentCompanyLogo(
  profile: ApifyProfile,
): string | null {
  return blank(pickHeadlineExperience(profile)?.logo);
}

export function buildAlumniPatch(
  profile: ApifyProfile,
  photoUrl: string | null
): AlumniPatch {
  const uwc = detectUwc(profile.educations);
  const headline = pickHeadlineExperience(profile);
  // Prefer the filtered headline (skips membership/advisor roles) when
  // it diverges from Apify's top-level jobTitle. Falls back to the
  // profile-level fields when nothing in experiences passes the filter
  // or experiences is missing entirely.
  const currentTitle = blank(headline?.title) ?? blank(profile.jobTitle);
  const currentCompany =
    blank(headline?.companyName) ?? blank(profile.companyName);
  const currentCompanyLinkedin =
    blank(headline?.companyLink1) ?? blank(profile.companyLinkedin);
  const currentCompanyIndustry =
    blank(headline?.companyIndustry) ?? blank(profile.companyIndustry);
  const currentCompanySize =
    blank(headline?.companySize) ?? blank(profile.companySize);
  const currentCompanyWebsite =
    blank(headline?.companyWebsite) ?? blank(profile.companyWebsite);
  const currentLocation =
    blank(headline?.jobLocation) ?? blank(profile.jobLocation);
  const currentSince =
    blank(
      typeof headline?.period?.startedOn === "string"
        ? headline.period.startedOn
        : headline?.jobStartedOn,
    ) ?? blank(profile.jobStartedOn);
  return {
    linkedin_url: profile.linkedinUrl ?? "",
    linkedin_alternate_email: blank(profile.email),
    headline: blank(profile.headline),
    about: blank(profile.about),
    location_city: blank(profile.addressWithoutCountry),
    location_country: blank(profile.addressCountryOnly),
    location_full: blank(profile.addressWithCountry),
    photo_url: photoUrl,
    current_title: currentTitle,
    current_company: currentCompany,
    current_company_linkedin: currentCompanyLinkedin,
    current_company_industry: currentCompanyIndustry,
    current_company_size: currentCompanySize,
    current_company_website: currentCompanyWebsite,
    current_company_logo_url: findCurrentCompanyLogo(profile),
    current_location: currentLocation,
    current_since: currentSince,
    total_experience_years:
      typeof profile.totalExperienceYears === "number" ? profile.totalExperienceYears : null,
    first_role_year:
      typeof profile.firstRoleYear === "number" ? profile.firstRoleYear : null,
    uwc_verified: uwc.verified,
    uwc_school_matched: uwc.matched,
  };
}

export function buildEducationRows(
  educations: ApifyEducationEntry[] | null | undefined
): EducationRow[] {
  if (!Array.isArray(educations)) return [];
  return educations.map((e, i) => {
    const blob = `${e.title ?? ""} ${e.subtitle ?? ""} ${e.description ?? ""}`;
    return {
      position: i,
      school: blank(e.title),
      school_id: blank(e.companyId),
      school_linkedin_url: blank(e.companyLink1),
      school_logo_url: blank(e.logo),
      degree_field: blank(e.subtitle),
      start_year: normYear(e.period?.startedOn),
      end_year: normYear(e.period?.endedOn),
      is_uwc: UWC_PATTERN.test(blob),
    };
  });
}

/** Last resort when Apify hands back an experience row without
 * exp.subtitle (the company name). LinkedIn URL slugs are reliable:
 * /company/the-world-bank-group/ → "The World Bank Group".
 *
 * Used when subtitle is missing — sometimes happens for promotion
 * chains and certain compact-card LinkedIn layouts where the company
 * name is rendered at the stack header rather than per-row. */
export function deriveCompanyFromLinkedinUrl(
  url: string | null | undefined,
): string | null {
  if (!url) return null;
  const m = url.match(/\/company\/([^/?#]+)/i);
  if (!m) return null;
  let slug = decodeURIComponent(m[1]).replace(/-+/g, " ").trim();
  if (!slug) return null;
  // Title-case each word.
  slug = slug
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
  return slug;
}

export function buildCareerRows(
  experiences: ApifyExperienceEntry[] | null | undefined
): CareerRow[] {
  if (!Array.isArray(experiences)) return [];
  return experiences.map((exp, i) => {
    const isCurrent = exp.jobStillWorking === true;
    const start = typeof exp.period?.startedOn === "string"
      ? exp.period.startedOn
      : exp.jobStartedOn ?? null;
    // Symmetry with `start`: prefer period.endedOn when populated,
    // fall back to top-level jobEndedOn. Older actor versions used
    // period.* but the newer ones return jobEndedOn at the top level
    // — without this fallback, ~83% of past jobs landed with a NULL
    // end_date and rendered as "Present" in the UI.
    const end = typeof exp.period?.endedOn === "string"
      ? exp.period.endedOn
      : exp.jobEndedOn ?? null;
    // Prefer exp.companyName when present — newer Apify versions
    // expose it as the canonical company name. Fall back to subtitle
    // (older versions) but skip it when it's all digits (those are
    // LinkedIn companyIds, not names). Last resort: derive from the
    // LinkedIn URL slug.
    const companyFromApify =
      blank(exp.companyName) ??
      (() => {
        const sub = blank(exp.subtitle);
        if (!sub) return null;
        return /^\d+$/.test(sub) ? null : sub;
      })();
    const company =
      companyFromApify ?? deriveCompanyFromLinkedinUrl(exp.companyLink1);
    return {
      position: i,
      title: blank(exp.title),
      company,
      company_linkedin_url: blank(exp.companyLink1),
      company_industry: blank(exp.companyIndustry),
      company_size: blank(exp.companySize),
      company_website: blank(exp.companyWebsite),
      company_logo_url: blank(exp.logo),
      start_date: blank(start),
      end_date: blank(end),
      location: blank(exp.jobLocation),
      is_current: isCurrent,
    };
  });
}

export function buildVolunteeringRows(
  volunteering: ApifyVolunteerEntry[] | null | undefined
): VolunteeringRow[] {
  if (!Array.isArray(volunteering)) return [];
  return volunteering.map((v) => {
    const end = normYear(v.period?.endedOn);
    return {
      organization: blank(v.organization ?? v.title),
      role: blank(v.role ?? v.subtitle),
      industry: blank(v.industry),
      start_year: normYear(v.period?.startedOn),
      end_year: end,
      is_current: end == null,
    };
  });
}
