CREATE TABLE IF NOT EXISTS alumni_candidates (
  id SERIAL PRIMARY KEY,
  linkedin_url TEXT UNIQUE NOT NULL,
  name_guess TEXT,
  title_snippet TEXT,
  body_snippet TEXT,
  source TEXT,
  search_query TEXT,
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'probable_match', 'scraped', 'added', 'rejected')),
  matched_alumni_id INT REFERENCES alumni(id) ON DELETE SET NULL,
  scraped_data JSONB,
  notes TEXT,
  discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS alumni_candidates_status_idx
  ON alumni_candidates(status, discovered_at DESC);
