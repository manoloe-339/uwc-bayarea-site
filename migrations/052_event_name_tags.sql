CREATE TABLE IF NOT EXISTS event_name_tags (
  id SERIAL PRIMARY KEY,
  event_id INT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  -- Nullable. When set, links the tag back to a ticket purchaser so
  -- 'Sync from attendees' can skip rows that already exist for that
  -- purchaser. Null for standalone tags (guests, VIPs) added manually.
  attendee_id INT REFERENCES event_attendees(id) ON DELETE SET NULL,
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  uwc_college TEXT,
  grad_year INT CHECK (grad_year IS NULL OR (grad_year BETWEEN 1960 AND 2100)),
  -- Optional 3rd / 4th printed lines, e.g. "Trustee", "Speaker", role/title.
  line_3 TEXT,
  line_4 TEXT,
  -- Internal admin reminder ("John's wife"). Never printed on the tag.
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS event_name_tags_event_idx
  ON event_name_tags(event_id);

-- One tag per attendee per event so re-syncing is idempotent.
CREATE UNIQUE INDEX IF NOT EXISTS event_name_tags_attendee_uniq
  ON event_name_tags(attendee_id)
  WHERE attendee_id IS NOT NULL;
