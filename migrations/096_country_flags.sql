-- Self-hosted country-flag repository. Each row points at a Vercel
-- Blob copy of the canonical Flagpedia SVG so we never depend on
-- flagcdn.com at runtime. Use `iso` (ISO 3166-1 alpha-2, lowercase)
-- as the join key from any caller; `name` is just for admin
-- legibility.
CREATE TABLE IF NOT EXISTS country_flags (
  iso         CHAR(2) PRIMARY KEY,
  name        TEXT NOT NULL,
  blob_url    TEXT NOT NULL,
  source      TEXT NOT NULL DEFAULT 'flagpedia',
  fetched_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
