-- Track every signup submission, both new and re-submissions.
-- When an existing alum re-submits the signup form, we want to know
-- field-by-field what they changed — including fields they tried to
-- update but the COALESCE-preserve upsert silently kept the old value
-- on.
--
-- payload  — the raw inbound submission body (post-normalization)
-- diff     — { "field_name": { from, to, applied } } for fields that
--            differ from the pre-existing row. `applied = false` means
--            the user submitted a new value but the upsert kept the
--            previously-stored value (current COALESCE behavior); those
--            are the most-interesting rows for admin review.
CREATE TABLE IF NOT EXISTS signup_submissions (
  id              SERIAL PRIMARY KEY,
  alumni_id       INTEGER REFERENCES alumni(id) ON DELETE CASCADE,
  submitted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payload         JSONB NOT NULL,
  diff            JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_resubmission BOOLEAN NOT NULL DEFAULT FALSE,
  status          TEXT NOT NULL DEFAULT 'unread',
  reviewed_at     TIMESTAMPTZ,
  reviewed_by     TEXT
);

CREATE INDEX IF NOT EXISTS signup_submissions_alumni_idx
  ON signup_submissions (alumni_id, submitted_at DESC);

-- Admin queue: unread re-submissions ordered by recency.
CREATE INDEX IF NOT EXISTS signup_submissions_queue_idx
  ON signup_submissions (submitted_at DESC)
  WHERE is_resubmission = TRUE AND status = 'unread';
