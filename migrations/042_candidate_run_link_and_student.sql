-- Link each candidate to the discovery run that found it, so we can
-- collapse "older runs" in the admin UI.
ALTER TABLE alumni_candidates
  ADD COLUMN IF NOT EXISTS run_id INT REFERENCES discovery_runs(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS alumni_candidates_run_idx ON alumni_candidates(run_id);

-- Backfill: pair each existing candidate with the most recent run that
-- started before its discovered_at timestamp.
UPDATE alumni_candidates ac
SET run_id = (
  SELECT r.id FROM discovery_runs r
  WHERE r.started_at <= ac.discovered_at
  ORDER BY r.started_at DESC
  LIMIT 1
)
WHERE ac.run_id IS NULL;

-- Widen triage_role check to include 'student' (current UWC student
-- — may register if family lives in the Bay Area).
ALTER TABLE alumni_candidates
  DROP CONSTRAINT IF EXISTS alumni_candidates_triage_role_check;
ALTER TABLE alumni_candidates
  ADD CONSTRAINT alumni_candidates_triage_role_check
  CHECK (triage_role IS NULL OR triage_role IN (
    'alum', 'student', 'teacher', 'staff', 'unrelated'
  ));
