/**
 * Shapes the Python service response into the alumni-table column
 * updates. Does NOT include first_name/last_name — user-provided names
 * are authoritative; if LinkedIn disagrees the admin should review
 * manually (Part B surfaces this in the needs_review queue).
 *
 * linkedin_raw_data holds the full response for later audit / re-transform.
 */

import type { EnrichmentResult } from "@/types/enrichment";

export type AlumniEnrichmentPatch = {
  linkedin_url: string;
  linkedin_alternate_email: string | null;
  headline: string | null;
  about: string | null;
  location_city: string | null;
  location_country: string | null;
  photo_url: string | null;
  current_company: string | null;
  current_title: string | null;
  uwc_verified: boolean;
  linkedin_enrichment_status: "complete";
  linkedin_enriched_at: string;
  linkedin_raw_data: EnrichmentResult;
};

export function transformEnrichmentResult(
  result: EnrichmentResult,
  photoUrl: string | null
): AlumniEnrichmentPatch {
  return {
    linkedin_url: result.linkedin_url,
    linkedin_alternate_email: result.alternate_email ?? null,
    headline: result.headline ?? null,
    about: result.about ?? null,
    location_city: result.location?.city ?? null,
    location_country: result.location?.country ?? null,
    photo_url: photoUrl,
    current_company: result.current_role?.company ?? null,
    current_title: result.current_role?.title ?? null,
    uwc_verified: result.uwc_verified ?? false,
    linkedin_enrichment_status: "complete",
    linkedin_enriched_at: new Date().toISOString(),
    linkedin_raw_data: result,
  };
}
