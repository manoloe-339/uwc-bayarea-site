ALTER TABLE site_settings
  ADD COLUMN IF NOT EXISTS photo_gallery_intro_eyebrow TEXT,
  ADD COLUMN IF NOT EXISTS photo_gallery_intro_headline TEXT,
  ADD COLUMN IF NOT EXISTS photo_gallery_intro_headline_accent TEXT,
  ADD COLUMN IF NOT EXISTS photo_gallery_intro_subhead TEXT;
