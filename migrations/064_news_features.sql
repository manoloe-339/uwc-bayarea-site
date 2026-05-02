-- Editorial "Alumni in the news" features for the homepage.
-- Each row is one alumnus + a pull quote + publication + article link.
-- The homepage section auto-picks layout by enabled-count:
--   1 enabled → spotlight (portrait + big quote)
--   2 enabled → side-by-side pair
--   0 enabled → section hidden
-- portrait_override_url lets admins use a different photo than the
-- alumni record's default (e.g., a published headshot from the article).
CREATE TABLE IF NOT EXISTS news_features (
  id                    SERIAL PRIMARY KEY,
  alumni_id             INTEGER REFERENCES alumni(id) ON DELETE SET NULL,
  publication           TEXT,
  date_label            TEXT,
  pull_quote            TEXT NOT NULL,
  article_url           TEXT,
  portrait_override_url TEXT,
  sort_order            INTEGER NOT NULL DEFAULT 0,
  enabled               BOOLEAN NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS news_features_active_sort_idx
  ON news_features (sort_order ASC, id ASC)
  WHERE enabled = TRUE;
