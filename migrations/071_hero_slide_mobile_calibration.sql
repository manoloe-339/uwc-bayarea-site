-- Per-slide mobile-specific focal point + zoom. The hero crops at
-- 21:9 on desktop but 4:5 on mobile, so the same calibration rarely
-- works for both shapes. These columns let admins re-frame photos
-- for the narrower mobile aspect.
--
-- Existing slides default to 'center' / 1.0× — same neutral as desktop
-- defaults. Extras (positions 1..N) get the same mobile keys inside
-- the extra_image_settings JSON; normalizeExtra() in lib falls back
-- to desktop values when the mobile keys are missing on legacy rows.
ALTER TABLE homepage_hero_slides
  ADD COLUMN IF NOT EXISTS mobile_focal_point TEXT NOT NULL DEFAULT 'center',
  ADD COLUMN IF NOT EXISTS mobile_zoom        NUMERIC(3, 2) NOT NULL DEFAULT 1.0;
