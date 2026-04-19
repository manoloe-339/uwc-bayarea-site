ALTER TABLE alumni ADD COLUMN IF NOT EXISTS moved_out BOOLEAN DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS alumni_moved_out_idx ON alumni (moved_out);
