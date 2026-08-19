-- Per-event opt-in for the top-nav "Events" featured item.
--   feature_in_nav — admin toggles from /admin/events/[slug]/edit
--   nav_label      — optional short label ("May 1"); NULL → event.name
--   nav_link_url   — optional URL override (bespoke landing, external
--                    RSVP, etc); NULL → /events/<slug>/photos
--
-- Nav picks the event with the soonest date when multiple are on.
-- No auto-unfeature; admin manually toggles off.
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS feature_in_nav BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS nav_label      TEXT,
  ADD COLUMN IF NOT EXISTS nav_link_url   TEXT;

CREATE INDEX IF NOT EXISTS events_feature_in_nav_idx
  ON events (date ASC) WHERE feature_in_nav = TRUE;
