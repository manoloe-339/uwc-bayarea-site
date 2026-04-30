-- Per-tag opt-in for printing the UWC globe logo in the top-left corner.
ALTER TABLE event_name_tags
  ADD COLUMN IF NOT EXISTS show_logo BOOLEAN NOT NULL DEFAULT FALSE;
