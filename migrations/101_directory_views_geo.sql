-- Capture coarse geolocation + user-agent on every directory_views
-- row so the admin activity feed shows "where was this from?"
-- alongside what action they took. Mirrors the marketing-site
-- `visits` table: no raw IPs stored — just the derived geo Vercel
-- already exposes via x-vercel-ip-* headers.
ALTER TABLE directory_views
  ADD COLUMN IF NOT EXISTS country    TEXT,
  ADD COLUMN IF NOT EXISTS region     TEXT,
  ADD COLUMN IF NOT EXISTS city       TEXT,
  ADD COLUMN IF NOT EXISTS user_agent TEXT;
