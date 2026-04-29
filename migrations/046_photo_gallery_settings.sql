ALTER TABLE site_settings
  ADD COLUMN IF NOT EXISTS photo_gallery_thumbs_per_row INT NOT NULL DEFAULT 4
    CHECK (photo_gallery_thumbs_per_row BETWEEN 3 AND 5),
  ADD COLUMN IF NOT EXISTS photo_gallery_marquee_paused BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS photo_gallery_show_intro BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS photo_gallery_slide_duration_sec INT NOT NULL DEFAULT 5
    CHECK (photo_gallery_slide_duration_sec BETWEEN 2 AND 12);
