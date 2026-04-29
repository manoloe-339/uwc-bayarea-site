-- Photo capture date from EXIF (when available). Used to sort the admin
-- tabs and the public gallery thumbnails by when a photo was taken instead
-- of when it was uploaded — matters for archive imports of old photos.
ALTER TABLE event_photos
  ADD COLUMN IF NOT EXISTS taken_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS event_photos_taken_at_idx
  ON event_photos(event_id, taken_at);
