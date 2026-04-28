CREATE TABLE IF NOT EXISTS discovery_query_templates (
  id SERIAL PRIMARY KEY,
  query TEXT NOT NULL UNIQUE,
  group_label TEXT NOT NULL DEFAULT '',
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS discovery_query_templates_enabled_idx
  ON discovery_query_templates(enabled, sort_order);

CREATE TABLE IF NOT EXISTS discovery_excluded_terms (
  id SERIAL PRIMARY KEY,
  term TEXT NOT NULL UNIQUE,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed initial queries (idempotent via UNIQUE on query).
INSERT INTO discovery_query_templates (query, group_label, sort_order) VALUES
  ('"UWC" "San Francisco Bay Area" site:linkedin.com/in/', 'uwc-broad', 10),
  ('"UWC" "Bay Area" site:linkedin.com/in/', 'uwc-broad', 20),
  ('"UWC" "San Francisco" site:linkedin.com/in/', 'uwc-broad', 30),
  ('"UWC" California site:linkedin.com/in/', 'uwc-broad', 40),
  ('"United World College" "Bay Area" site:linkedin.com/in/', 'united-world-college', 50),
  ('"United World College" "San Francisco" site:linkedin.com/in/', 'united-world-college', 60),
  ('"Davis Scholar" "San Francisco" site:linkedin.com/in/', 'davis-scholar', 70),
  ('"Davis Scholar" "Bay Area" site:linkedin.com/in/', 'davis-scholar', 80),
  ('"UWC" Berkeley site:linkedin.com/in/', 'uwc-city', 90),
  ('"UWC" "Palo Alto" site:linkedin.com/in/', 'uwc-city', 100),
  ('"UWC" "San Jose" site:linkedin.com/in/', 'uwc-city', 110),
  ('"UWC" Oakland site:linkedin.com/in/', 'uwc-city', 120),
  ('"UWC" "Mountain View" site:linkedin.com/in/', 'uwc-city', 130),
  ('"UWC" "Marin" site:linkedin.com/in/', 'uwc-city', 140),
  ('"UWC" "South Bay" site:linkedin.com/in/', 'uwc-region', 150),
  ('"UWC" "East Bay" site:linkedin.com/in/', 'uwc-region', 160),
  ('"UWC" "Peninsula" site:linkedin.com/in/', 'uwc-region', 170),
  ('"Atlantic College" "Bay Area" site:linkedin.com/in/', 'bare-college', 180),
  ('"Pearson College" "San Francisco" site:linkedin.com/in/', 'bare-college', 190),
  ('"Li Po Chun" "Bay Area" site:linkedin.com/in/', 'bare-college', 200),
  ('"Waterford Kamhlaba" "Bay Area" site:linkedin.com/in/', 'bare-college', 210),
  ('"UWCSEA" "Bay Area" site:linkedin.com/in/', 'bare-college', 220),
  ('"UWC USA" "Bay Area" site:linkedin.com/in/', 'bare-college', 230),
  ('"UWC Adriatic" "Bay Area" site:linkedin.com/in/', 'bare-college', 240),
  ('"UWC Costa Rica" "Bay Area" site:linkedin.com/in/', 'bare-college', 250),
  ('"UWC Red Cross Nordic" "San Francisco" site:linkedin.com/in/', 'bare-college', 260)
ON CONFLICT (query) DO NOTHING;

-- Seed excluded terms.
INSERT INTO discovery_excluded_terms (term, note) VALUES
  ('University of the Western Cape', 'South African university (UWC), unrelated to United World Colleges'),
  ('Western Cape', 'See above; broader catch')
ON CONFLICT (term) DO NOTHING;
