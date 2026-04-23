-- Marks alumni who have passed away. Excluded from email sends and from
-- the default alumni search view (with an opt-in checkbox to include them).
-- Admin-only flag; set manually from the detail page.

ALTER TABLE alumni
  ADD COLUMN IF NOT EXISTS deceased BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS alumni_deceased_idx
  ON alumni (deceased) WHERE deceased = TRUE;
