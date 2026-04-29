ALTER TABLE site_settings
  DROP CONSTRAINT IF EXISTS site_settings_photo_gallery_slide_duration_sec_check;

ALTER TABLE site_settings
  ADD CONSTRAINT site_settings_photo_gallery_slide_duration_sec_check
    CHECK (photo_gallery_slide_duration_sec BETWEEN 2 AND 60);
