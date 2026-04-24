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
