-- Per-tag review state. Only 'finalized' tags will be included when we
-- generate the printable PDF in a follow-up step.
ALTER TABLE event_name_tags
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'fix', 'finalized'));

CREATE INDEX IF NOT EXISTS event_name_tags_status_idx
  ON event_name_tags(event_id, status);
