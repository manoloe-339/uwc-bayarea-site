CREATE TABLE IF NOT EXISTS alumni (
  id            SERIAL PRIMARY KEY,
  submitted_at  TIMESTAMPTZ,
  first_name    TEXT,
  last_name     TEXT,
  email         TEXT UNIQUE NOT NULL,
  mobile        TEXT,
  origin        TEXT,
  uwc_college       TEXT,
  uwc_college_raw   TEXT,
  grad_year         INTEGER,
  grad_year_raw     TEXT,
  current_city  TEXT,
  help_tags     TEXT,
  national_committee TEXT,
  about         TEXT,
  questions     TEXT,
  studying      TEXT,
  working       TEXT,
  flags         TEXT[] DEFAULT '{}',
  imported_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS alumni_college_idx   ON alumni (uwc_college);
CREATE INDEX IF NOT EXISTS alumni_grad_year_idx ON alumni (grad_year);
CREATE INDEX IF NOT EXISTS alumni_origin_idx    ON alumni (origin);
CREATE INDEX IF NOT EXISTS alumni_city_idx      ON alumni (lower(current_city));
CREATE INDEX IF NOT EXISTS alumni_name_idx      ON alumni (lower(first_name), lower(last_name));
