ALTER TABLE site_settings
  ADD COLUMN IF NOT EXISTS photo_gallery_marquee_speed_sec INT NOT NULL DEFAULT 70
    CHECK (photo_gallery_marquee_speed_sec BETWEEN 20 AND 200);
