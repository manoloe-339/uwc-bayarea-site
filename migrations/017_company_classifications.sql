-- Per-company classifications produced by an LLM (Claude Haiku) to answer
-- questions LinkedIn's own industry taxonomy can't, e.g. "is this a real
-- startup?" or "is this a tech company?" (LinkedIn tags Anthropic as
-- 'Research Services', so we need richer labels to filter meaningfully).
--
-- Keyed on a lowercase-trimmed canonical of the company name so we can join
-- to alumni.current_company without requiring current_company_id.

CREATE TABLE IF NOT EXISTS company_classifications (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  company_key     TEXT         NOT NULL UNIQUE,
  company_name    TEXT         NOT NULL,
  -- Flags (null = not classified yet)
  is_tech         BOOLEAN,
  is_startup      BOOLEAN,
  is_public       BOOLEAN,
  is_subsidiary   BOOLEAN,
  parent_company  TEXT,
  sector          TEXT,
  -- Metadata
  confidence      REAL,
  reasoning       TEXT,
  model           TEXT,
  needs_review    BOOLEAN      NOT NULL DEFAULT FALSE,
  classified_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS company_classifications_is_tech_idx
  ON company_classifications (is_tech) WHERE is_tech IS NOT NULL;
CREATE INDEX IF NOT EXISTS company_classifications_is_startup_idx
  ON company_classifications (is_startup) WHERE is_startup IS NOT NULL;
CREATE INDEX IF NOT EXISTS company_classifications_needs_review_idx
  ON company_classifications (needs_review) WHERE needs_review = TRUE;
