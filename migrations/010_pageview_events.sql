-- Per-visit pageview rows for referrer + approximate location analytics.
-- Coarse location only (country/region/city) from Vercel's built-in geo
-- lookup — no IPs stored.
CREATE TABLE IF NOT EXISTS pageview_events (
  id               BIGSERIAL PRIMARY KEY,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  path             TEXT        NOT NULL,
  referrer_domain  TEXT,
  country          TEXT,
  region           TEXT,
  city             TEXT,
  user_agent       TEXT
);

CREATE INDEX IF NOT EXISTS pageview_events_created_idx      ON pageview_events (created_at DESC);
CREATE INDEX IF NOT EXISTS pageview_events_referrer_idx     ON pageview_events (referrer_domain);
CREATE INDEX IF NOT EXISTS pageview_events_country_idx      ON pageview_events (country);
