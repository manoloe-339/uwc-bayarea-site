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

/** Pull a logo URL for the current company by finding the current
 * experience entry (jobStillWorking === true). If none flagged
 * current, the first experience is the de-facto headline. */
function findCurrentCompanyLogo(
  profile: ApifyProfile,
): string | null {
  if (!Array.isArray(profile.experiences) || profile.experiences.length === 0) {
    return null;
  }
  const current = profile.experiences.find((e) => e.jobStillWorking === true);
  return blank(current?.logo) ?? blank(profile.experiences[0]?.logo);
}

export function buildAlumniPatch(
  profile: ApifyProfile,
  photoUrl: string | null
): AlumniPatch {
  const uwc = detectUwc(profile.educations);
  const startedOn = profile.jobStartedOn ?? null;
  return {
    linkedin_url: profile.linkedinUrl ?? "",
    linkedin_alternate_email: blank(profile.email),
    headline: blank(profile.headline),
    about: blank(profile.about),
    location_city: blank(profile.addressWithoutCountry),
    location_country: blank(profile.addressCountryOnly),
    location_full: blank(profile.addressWithCountry),
    photo_url: photoUrl,
    current_title: blank(profile.jobTitle),
    current_company: blank(profile.companyName),
    current_company_linkedin: blank(profile.companyLinkedin),
    current_company_industry: blank(profile.companyIndustry),
    current_company_size: blank(profile.companySize),
    current_company_website: blank(profile.companyWebsite),
    current_company_logo_url: findCurrentCompanyLogo(profile),
    current_location: blank(profile.jobLocation),
    current_since: blank(startedOn),
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
    const end = typeof exp.period?.endedOn === "string"
      ? exp.period.endedOn
      : null;
    // Prefer the explicit subtitle text; if it's missing, derive the
    // company name from the LinkedIn URL slug rather than storing null.
    const companyFromSubtitle = blank(exp.subtitle);
    const company =
      companyFromSubtitle ?? deriveCompanyFromLinkedinUrl(exp.companyLink1);
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
