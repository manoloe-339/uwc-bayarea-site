ALTER TABLE event_photos
  ADD COLUMN IF NOT EXISTS display_role TEXT
    CHECK (display_role IS NULL OR display_role IN ('marquee', 'supporting')),
  ADD COLUMN IF NOT EXISTS display_order INT;

CREATE INDEX IF NOT EXISTS event_photos_layout_idx
  ON event_photos(event_id, display_role, display_order)
  WHERE approval_status = 'approved';
