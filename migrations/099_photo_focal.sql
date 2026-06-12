-- Per-alum photo focal point. Stored as integer percentages
-- (0..100) of the source image. The UI uses these to set the
-- `object-position` of the rendered <img> so heads stop getting
-- cropped off the top of the directory cards. NULL → fall back
-- to a reasonable default (~"50 25" — head-favouring).
--
-- Populated once via scripts/detect-photo-focal.mjs (face
-- detection) and refreshed when a new photo is uploaded or when
-- we re-tune the detector.
ALTER TABLE alumni
  ADD COLUMN IF NOT EXISTS photo_focal_x   SMALLINT,
  ADD COLUMN IF NOT EXISTS photo_focal_y   SMALLINT,
  ADD COLUMN IF NOT EXISTS photo_focal_at  TIMESTAMPTZ;
