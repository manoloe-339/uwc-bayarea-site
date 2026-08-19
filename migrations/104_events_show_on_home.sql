-- Per-event opt-in for the homepage "Highlights" row (photo strip
-- inside the "Around the Bay" umbrella, sits above the Foodies
-- sub-block). Admin flips this from /admin/events/[slug]/edit.
-- Homepage filters to show_on_home=TRUE past events that also have
-- an approved gallery photo — no photo → not shown (partial index
-- speeds the homepage query).
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS show_on_home BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS events_show_on_home_idx
  ON events (date DESC) WHERE show_on_home = TRUE;
