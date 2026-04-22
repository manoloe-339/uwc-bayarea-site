-- Admin follow-up flag: a record flagged here surfaces in the search filter
-- so the admin can work through follow-ups as a queue. Presence of a value
-- means "needs follow-up"; NULL means no action needed.

ALTER TABLE alumni ADD COLUMN IF NOT EXISTS followup_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_alumni_followup_reason
  ON alumni (followup_reason)
  WHERE followup_reason IS NOT NULL;
