-- Optional admin-curated "current role" line for the alumni news
-- byline (e.g. "Senior Analyst at Goldman Sachs"). Falls back to
-- alumni.current_title + alumni.current_company when null.
ALTER TABLE news_features
  ADD COLUMN IF NOT EXISTS current_role_override TEXT;
