CREATE TABLE IF NOT EXISTS volunteer_signups (
  id SERIAL PRIMARY KEY,
  -- The alumni row matched at submit time, if any. Null when the
  -- submitter wasn't found in the directory. Loosely linked — alumni
  -- deletes don't cascade so the historical record survives.
  alumni_id INT REFERENCES alumni(id) ON DELETE SET NULL,
  submitted_name TEXT NOT NULL,
  submitted_email TEXT NOT NULL,
  -- Multi-select volunteer areas: 'national', 'outreach', 'events',
  -- 'donors', 'other'. Stored as a TEXT[] for easy filtering.
  areas TEXT[] NOT NULL DEFAULT '{}',
  -- Free text when 'national' is selected (which national committee
  -- they want to work with). Optional.
  national_committee_choice TEXT,
  -- 'Anything else' free-form note. Optional.
  note TEXT,
  -- When admin marks as contacted in the triage view.
  contacted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS volunteer_signups_created_idx
  ON volunteer_signups(created_at DESC);
CREATE INDEX IF NOT EXISTS volunteer_signups_alumni_idx
  ON volunteer_signups(alumni_id);
