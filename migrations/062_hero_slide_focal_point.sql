-- Per-slide focal point for the hero carousel. Controls how the
-- background photo is cropped when the container aspect ratio differs
-- from the photo. Maps directly to CSS object-position values.
-- Allowed values: 'top' | 'center' | 'bottom'. Default 'center'.
ALTER TABLE homepage_hero_slides
  ADD COLUMN IF NOT EXISTS focal_point TEXT NOT NULL DEFAULT 'center';
