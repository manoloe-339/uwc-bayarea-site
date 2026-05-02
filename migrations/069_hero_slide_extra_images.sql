-- Per-slide multi-image expansion. When admin wants to show multiple
-- photos from a single event's gallery (e.g. 5 photos from eSwatini),
-- they specify N additional images here. Each entry stores its own
-- focal_point + zoom so each photo can be calibrated independently.
--
-- Position 0 (the slide's primary image) continues to use the existing
-- focal_point + zoom columns on homepage_hero_slides. Positions 1..N
-- pull from getApprovedPhotosOrdered(event_id) in gallery order.
ALTER TABLE homepage_hero_slides
  ADD COLUMN IF NOT EXISTS extra_image_settings JSONB NOT NULL DEFAULT '[]'::jsonb;
