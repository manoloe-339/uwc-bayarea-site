-- Optional Google Maps (or any) URL for the event's address. Used to
-- turn the "Where:" line in reminder emails into a link.
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS location_map_url TEXT;
