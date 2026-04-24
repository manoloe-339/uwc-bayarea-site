-- LinkedIn auto-enrichment tracking (async Railway Python service).
-- Existing CSV-based enrichment columns (enriched_at, enrichment_source,
-- sources, headline, about, location_city, location_country, photo_url,
-- current_company, current_title, uwc_verified, linkedin_url,
-- linkedin_alternate_email) are all reused — this migration only adds
-- the async-job tracking state alongside them.

ALTER TABLE alumni ADD COLUMN IF NOT EXISTS linkedin_enrichment_status TEXT;
-- Values: 'pending' | 'complete' | 'failed' | 'needs_review' | NULL

ALTER TABLE alumni ADD COLUMN IF NOT EXISTS linkedin_enrichment_job_id TEXT;
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS linkedin_enriched_at TIMESTAMPTZ;
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS linkedin_enrichment_error TEXT;
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS linkedin_raw_data JSONB;

-- Defensive: these already exist in production but keeping them here with
-- IF NOT EXISTS so a fresh bootstrap against an older schema also works.
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS headline TEXT;
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS about TEXT;
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS location_city TEXT;
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS location_country TEXT;
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS current_company TEXT;
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS current_title TEXT;
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS uwc_verified BOOLEAN DEFAULT FALSE;

-- Admin review queue (Part B will build the UI).
CREATE INDEX IF NOT EXISTS alumni_enrichment_review_idx
  ON alumni (linkedin_enrichment_status)
  WHERE linkedin_enrichment_status = 'needs_review';

CREATE INDEX IF NOT EXISTS alumni_enrichment_pending_idx
  ON alumni (linkedin_enrichment_job_id)
  WHERE linkedin_enrichment_status = 'pending';
