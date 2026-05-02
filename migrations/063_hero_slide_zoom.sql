-- Per-slide zoom factor for the hero photo. 1.0 = default (object-cover
-- fills the container, current behavior). >1.0 = scale up further
-- (tighter crop). <1.0 = scale down so more of the photo shows
-- (letterboxed by the navy hero background).
ALTER TABLE homepage_hero_slides
  ADD COLUMN IF NOT EXISTS zoom NUMERIC(3, 2) NOT NULL DEFAULT 1.0;
