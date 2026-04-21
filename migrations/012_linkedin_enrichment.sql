-- Schema for the LinkedIn enrichment pass.
-- All net-new columns on `alumni` (avoiding collisions with `about`, `company`,
-- `current_city`, `linkedin_url` which already exist from earlier migrations).

-- ---------- alumni parent extras ----------
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS linkedin_alternate_email  TEXT;
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS headline                  TEXT;
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS linkedin_about            TEXT;
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS location_full             TEXT;
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS location_city             TEXT;
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS location_country          TEXT;
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS photo_url                 TEXT;

ALTER TABLE alumni ADD COLUMN IF NOT EXISTS current_title             TEXT;
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS current_company           TEXT;
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS current_company_id        TEXT;
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS current_company_linkedin  TEXT;
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS current_company_industry  TEXT;
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS current_company_size      TEXT;
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS current_company_website   TEXT;
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS current_location          TEXT;
-- current_since stores "M-YYYY" strings verbatim from the enrichment source
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS current_since             TEXT;

ALTER TABLE alumni ADD COLUMN IF NOT EXISTS uwc_verified              BOOLEAN DEFAULT FALSE;
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS uwc_school_matched        TEXT;
-- total_experience_years is a float (e.g. 6.3), hence NUMERIC not INTEGER
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS total_experience_years    NUMERIC(5,2);
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS first_role_year           INTEGER;

ALTER TABLE alumni ADD COLUMN IF NOT EXISTS enriched_at               TIMESTAMPTZ;
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS enrichment_source         TEXT;

CREATE INDEX IF NOT EXISTS alumni_current_company_id_idx       ON alumni (current_company_id);
CREATE INDEX IF NOT EXISTS alumni_current_company_industry_idx ON alumni (current_company_industry);
CREATE INDEX IF NOT EXISTS alumni_location_country_idx         ON alumni (location_country);
CREATE INDEX IF NOT EXISTS alumni_uwc_verified_idx             ON alumni (uwc_verified);

-- ---------- alumni_career ----------
CREATE TABLE IF NOT EXISTS alumni_career (
  id                   SERIAL PRIMARY KEY,
  alumni_id            INT NOT NULL REFERENCES alumni(id) ON DELETE CASCADE,
  position             INT NOT NULL,
  title                TEXT,
  company              TEXT,
  company_id           TEXT,
  company_linkedin_url TEXT,
  company_industry     TEXT,
  company_size         TEXT,
  company_website      TEXT,
  start_date           TEXT,
  end_date             TEXT,
  location             TEXT,
  is_current           BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS alumni_career_alumni_current_idx ON alumni_career (alumni_id, is_current);
CREATE INDEX IF NOT EXISTS alumni_career_company_id_idx     ON alumni_career (company_id);

-- ---------- alumni_education ----------
CREATE TABLE IF NOT EXISTS alumni_education (
  id                  SERIAL PRIMARY KEY,
  alumni_id           INT NOT NULL REFERENCES alumni(id) ON DELETE CASCADE,
  position            INT NOT NULL,
  school              TEXT NOT NULL,
  school_id           TEXT,
  school_linkedin_url TEXT,
  degree_field        TEXT,
  start_year          INT,
  end_year            INT,
  is_uwc              BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS alumni_education_alumni_idx ON alumni_education (alumni_id);

-- ---------- alumni_volunteering ----------
CREATE TABLE IF NOT EXISTS alumni_volunteering (
  id           SERIAL PRIMARY KEY,
  alumni_id    INT NOT NULL REFERENCES alumni(id) ON DELETE CASCADE,
  organization TEXT,
  role         TEXT,
  industry     TEXT,
  start_year   INT,
  end_year     INT,
  is_current   BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS alumni_volunteering_alumni_idx ON alumni_volunteering (alumni_id);
