ALTER TABLE events
  ADD COLUMN IF NOT EXISTS event_type TEXT NOT NULL DEFAULT 'ticketed'
    CHECK (event_type IN ('ticketed', 'casual'));

CREATE INDEX IF NOT EXISTS events_event_type_idx ON events(event_type);
