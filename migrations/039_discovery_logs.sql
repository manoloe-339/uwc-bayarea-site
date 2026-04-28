CREATE TABLE IF NOT EXISTS discovery_runs (
  id SERIAL PRIMARY KEY,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  total_queries INT NOT NULL DEFAULT 0,
  total_hits INT NOT NULL DEFAULT 0,
  unique_urls INT NOT NULL DEFAULT 0,
  new_candidates INT NOT NULL DEFAULT 0,
  probable_matches INT NOT NULL DEFAULT 0,
  skipped_in_db INT NOT NULL DEFAULT 0,
  skipped_existing_candidate INT NOT NULL DEFAULT 0,
  cost_usd NUMERIC(8, 4) NOT NULL DEFAULT 0,
  error TEXT
);

CREATE TABLE IF NOT EXISTS discovery_query_logs (
  id SERIAL PRIMARY KEY,
  run_id INT NOT NULL REFERENCES discovery_runs(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('serper', 'exa')),
  group_label TEXT,
  hits_returned INT NOT NULL DEFAULT 0,
  unique_linkedin_urls INT NOT NULL DEFAULT 0,
  new_in_db INT NOT NULL DEFAULT 0,
  cost_usd NUMERIC(8, 4) NOT NULL DEFAULT 0,
  error TEXT,
  ran_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS discovery_query_logs_run_idx
  ON discovery_query_logs(run_id);
CREATE INDEX IF NOT EXISTS discovery_query_logs_yield_idx
  ON discovery_query_logs(query, new_in_db DESC);
