ALTER TABLE alumni ADD COLUMN IF NOT EXISTS sources TEXT[] DEFAULT '{}';
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS affiliation TEXT;
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS company TEXT;
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS attended_event BOOLEAN DEFAULT FALSE;

UPDATE alumni
SET sources = ARRAY['google_form_uwcx']
WHERE sources IS NULL OR array_length(sources, 1) IS NULL;

CREATE INDEX IF NOT EXISTS alumni_affiliation_idx ON alumni (affiliation);
