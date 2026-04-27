-- Per-event photo gallery. Admin uploads today; future build will let
-- attendees upload too (hence approval_status default 'pending' so a
-- moderation queue exists from day one).
--
-- We don't reference a users table because this is a solo-admin codebase;
-- approved_by stays nullable text-style for forward compatibility if multi-
-- admin gets added later.

CREATE TABLE IF NOT EXISTS event_photos (
  id SERIAL PRIMARY KEY,
  event_id INT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  uploaded_by_attendee_id INT REFERENCES event_attendees(id) ON DELETE SET NULL,
  uploaded_by_admin BOOLEAN NOT NULL DEFAULT FALSE,
  blob_url TEXT NOT NULL,
  blob_pathname TEXT NOT NULL,
  original_filename TEXT,
  file_size_bytes INT,
  content_type TEXT,
  width INT,
  height INT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approval_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  approved_at TIMESTAMPTZ,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS event_photos_event_idx ON event_photos(event_id);
CREATE INDEX IF NOT EXISTS event_photos_status_idx
  ON event_photos(event_id, approval_status);
