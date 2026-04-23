-- Gender field, auto-populated by a Claude-Haiku pass that uses the first
-- name, origin country, and LinkedIn headline/about (for explicit pronoun
-- signals). Values: 'male' | 'female' | 'they' | 'unknown' | NULL (not yet
-- classified). Admin can override per-record on the detail page.

ALTER TABLE alumni ADD COLUMN IF NOT EXISTS gender TEXT;
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS gender_confidence REAL;
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS gender_source TEXT;
-- 'llm' when set by the batch classifier; 'admin' when overridden manually.

CREATE INDEX IF NOT EXISTS alumni_gender_idx ON alumni (gender) WHERE gender IS NOT NULL;
