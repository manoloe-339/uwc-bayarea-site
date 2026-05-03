-- Editorial list of "featured alumni" per event — the people the
-- admin wants surfaced at the top of the public gallery page.
-- Examples: guest speakers and leads on a fireside, the two hosts
-- on a Foodies meal, the headliner on a panel.
--
-- role_label is an optional per-row override for the secondary line
-- (e.g. "Guest speaker", "Co-host"). When null, the public render
-- falls back to alumni.current_title + alumni.current_company.
CREATE TABLE IF NOT EXISTS event_featured_alumni (
  id          SERIAL PRIMARY KEY,
  event_id    INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  alumni_id   INTEGER NOT NULL REFERENCES alumni(id) ON DELETE CASCADE,
  role_label  TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, alumni_id)
);

CREATE INDEX IF NOT EXISTS event_featured_alumni_event_idx
  ON event_featured_alumni (event_id, sort_order ASC, id ASC);
