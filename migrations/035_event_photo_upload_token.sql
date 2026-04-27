ALTER TABLE events ADD COLUMN IF NOT EXISTS photo_upload_token TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS photo_upload_enabled BOOLEAN NOT NULL DEFAULT FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_events_photo_upload_token
  ON events(photo_upload_token)
  WHERE photo_upload_token IS NOT NULL;
