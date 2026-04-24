/**
 * Shapes that flow between the Next app and the Railway Python
 * enrichment service. Kept in /types so the lib/ module and any
 * future API callers share a single source of truth.
 */

export type EnrichmentStatus =
  | "pending"
  | "complete"
  | "failed"
  | "needs_review"
  | null;

export interface EnrichmentRequest {
  linkedin_url?: string | null;
  first_name: string;
  last_name: string;
  email?: string | null;
  uwc_college?: string | null;
  grad_year?: number | null;
  company?: string | null;
}

export interface EnrichmentResult {
  linkedin_url: string;
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  headline?: string | null;
  about?: string | null;
  location?: {
    city?: string | null;
    country?: string | null;
    full?: string | null;
  } | null;
  photo_url?: string | null;
  current_role?: {
    title?: string | null;
    company?: string | null;
    company_linkedin_url?: string | null;
  } | null;
  education?: Array<{
    school: string;
    degree_field?: string | null;
    start_year?: number | null;
    end_year?: number | null;
  }>;
  uwc_verified?: boolean;
  uwc_school_matched?: string | null;
  alternate_email?: string | null;
  needs_review?: boolean;
  candidate_url?: string | null;
  confidence?: "high" | "medium" | "low";
  reasoning?: string | null;
}

export interface JobResponse {
  job_id: string;
  status: "queued" | "running" | "done" | "failed";
  result?: EnrichmentResult;
  error?: string;
}

/* ------------------------------------------------------------------ */
/* Apify Linkedin-Profile-Scraper response shape                      */
/* ------------------------------------------------------------------ */

export interface ApifyEducationEntry {
  title?: string | null;
  subtitle?: string | null;
  description?: string | null;
  companyId?: string | null;
  companyLink1?: string | null;
  period?: {
    startedOn?: { year?: number | string | null } | number | string | null;
    endedOn?: { year?: number | string | null } | number | string | null;
  } | null;
}

export interface ApifyExperienceEntry {
  title?: string | null;
  subtitle?: string | null;
  description?: string | null;
  companyLink1?: string | null;
  companyId?: string | null;
  companyIndustry?: string | null;
  companySize?: string | null;
  companyWebsite?: string | null;
  jobLocation?: string | null;
  jobStartedOn?: string | null;
  jobEndedOn?: string | null;
  jobStillWorking?: boolean | null;
  period?: {
    startedOn?: string | { year?: number | string | null } | null;
    endedOn?: string | { year?: number | string | null } | null;
  } | null;
}

export interface ApifyVolunteerEntry {
  organization?: string | null;
  role?: string | null;
  title?: string | null;
  subtitle?: string | null;
  industry?: string | null;
  period?: {
    startedOn?: { year?: number | string | null } | number | string | null;
    endedOn?: { year?: number | string | null } | number | string | null;
  } | null;
}

export interface ApifyProfile {
  linkedinUrl?: string | null;
  publicIdentifier?: string | null;
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  headline?: string | null;
  about?: string | null;
  addressWithCountry?: string | null;
  addressWithoutCountry?: string | null;
  addressCountryOnly?: string | null;
  profilePic?: string | null;
  profilePicHighQuality?: string | null;
  jobTitle?: string | null;
  companyName?: string | null;
  companyLinkedin?: string | null;
  companyIndustry?: string | null;
  companySize?: string | null;
  companyWebsite?: string | null;
  jobLocation?: string | null;
  jobStartedOn?: string | null;
  jobStillWorking?: boolean | null;
  educations?: ApifyEducationEntry[] | null;
  experiences?: ApifyExperienceEntry[] | null;
  volunteerAndAwards?: ApifyVolunteerEntry[] | null;
  totalExperienceYears?: number | null;
  firstRoleYear?: number | null;
  email?: string | null;
}

/* ------------------------------------------------------------------ */
/* Candidate discovery (Scenario B)                                   */
/* ------------------------------------------------------------------ */

export type CandidateSource =
  | "serper-quoted"
  | "serper-uwc"
  | "serper-location"
  | "serper-broad"
  | "serper-davis"
  | "serper-quoted-post"
  | "exa";

export interface LinkedinCandidate {
  url: string;
  title: string;
  text: string;
  source: CandidateSource;
}

export interface BioSnippet {
  url: string;
  title: string;
  text: string;
}

export interface MatchDecision {
  chosen_url: string | null;
  confidence: "high" | "medium" | "low" | "none";
  reasoning: string;
}
