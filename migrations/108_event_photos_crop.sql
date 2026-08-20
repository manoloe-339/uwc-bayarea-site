-- Full crop rectangle (0-100% of source in x/y/w/h) for newsletter
-- cell rendering. Replaces the focal_x/y point which couldn't express
-- "zoom out to include more of the source" — you can now drag AND
-- resize the crop region. focal_x/y stay for backward compat with any
-- adjustments made before this migration (none in prod use yet).
ALTER TABLE event_photos
  ADD COLUMN IF NOT EXISTS crop_x NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS crop_y NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS crop_w NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS crop_h NUMERIC(5,2);
