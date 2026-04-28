ALTER TABLE alumni_candidates
  ADD COLUMN IF NOT EXISTS triage_confidence TEXT
    CHECK (triage_confidence IS NULL OR triage_confidence IN ('high', 'medium', 'low')),
  ADD COLUMN IF NOT EXISTS triage_role TEXT
    CHECK (triage_role IS NULL OR triage_role IN ('alum', 'teacher', 'staff', 'unrelated')),
  ADD COLUMN IF NOT EXISTS triage_reasoning TEXT;

-- Widen status to include 'possible_match' (last name + first initial only).
-- Constraint kept idempotent / forward-compatible by including statuses
-- introduced in later migrations (041, 043), since the migrate script
-- re-runs every migration on each invocation.
ALTER TABLE alumni_candidates DROP CONSTRAINT IF EXISTS alumni_candidates_status_check;
ALTER TABLE alumni_candidates ADD CONSTRAINT alumni_candidates_status_check
  CHECK (status IN (
    'new', 'probable_match', 'possible_match',
    'confirmed', 'invited_linkedin', 'already_connected',
    'scraped', 'added', 'rejected'
  ));

CREATE INDEX IF NOT EXISTS alumni_candidates_triage_idx
  ON alumni_candidates(status, triage_confidence DESC NULLS LAST, discovered_at DESC);
