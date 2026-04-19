ALTER TABLE alumni ADD COLUMN IF NOT EXISTS region TEXT;
CREATE INDEX IF NOT EXISTS alumni_region_idx ON alumni (region);
