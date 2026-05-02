-- Foodies-meal flag + meta fields. A Foodies meal is always a 'casual'
-- event with is_foodies = true. The meta fields drive the per-card content
-- on the new homepage Foodies section (region badge, cuisine line,
-- neighborhood, two hosts).
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS is_foodies   BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS foodies_region        TEXT,
  ADD COLUMN IF NOT EXISTS foodies_cuisine       TEXT,
  ADD COLUMN IF NOT EXISTS foodies_neighborhood  TEXT,
  ADD COLUMN IF NOT EXISTS foodies_host_1        TEXT,
  ADD COLUMN IF NOT EXISTS foodies_host_2        TEXT;

-- region is a tight enum at the UI level (SF / East Bay / Peninsula /
-- North Bay) but kept as TEXT so we can add new regions without a
-- schema change.
CREATE INDEX IF NOT EXISTS events_is_foodies_date_idx
  ON events (is_foodies, date)
  WHERE is_foodies = TRUE;
