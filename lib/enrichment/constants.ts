/**
 * Configuration knobs for the LinkedIn enrichment pipeline.
 * Tunables live here so the rest of the module reads cleanly.
 */

export const ENRICHMENT_CONFIG = {
  /** Railway Python service base URL, e.g. https://uwc-alumni-search-production.up.railway.app */
  SERVICE_URL: process.env.LINKEDIN_ENRICHMENT_URL ?? "",

  /** Max number of GET /enrich/{job_id} attempts before giving up. */
  MAX_POLL_ATTEMPTS: 20,

  /** Wait between poll attempts. 20 × 5s = 100s — matches the
   *  15–55s typical runtime + 45s headroom. */
  POLL_INTERVAL_MS: 5_000,

  /** Prefix used when uploading enriched photos to Vercel Blob. */
  PHOTO_STORAGE_PREFIX: "alumni-photos/",
} as const;

export function assertServiceUrl(): string {
  if (!ENRICHMENT_CONFIG.SERVICE_URL) {
    throw new Error(
      "LINKEDIN_ENRICHMENT_URL is not set — add the Railway service URL to env"
    );
  }
  return ENRICHMENT_CONFIG.SERVICE_URL;
}
