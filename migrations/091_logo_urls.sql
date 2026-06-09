-- Capture LinkedIn-served company / school logo URLs from the Apify
-- payload so we can render them directly without bouncing through
-- Logo.dev for every request.
--
-- Caveat: LinkedIn signs these media URLs with an expiry timestamp
-- (the ?e=... query param). They typically remain valid for weeks but
-- WILL eventually 404. Render path falls back to Logo.dev → initials
-- on error, and the next re-enrichment cycle refreshes the URL.

ALTER TABLE alumni
  ADD COLUMN IF NOT EXISTS current_company_logo_url TEXT;

ALTER TABLE alumni_career
  ADD COLUMN IF NOT EXISTS company_logo_url TEXT;

ALTER TABLE alumni_education
  ADD COLUMN IF NOT EXISTS school_logo_url TEXT;
