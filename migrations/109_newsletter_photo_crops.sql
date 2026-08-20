-- Newsletter-scoped photo crop rectangles. Kept OUT of event_photos on
-- purpose: newsletter cells are always 1:1 so a wide/tall gallery
-- photo needs a square selection; that square is a newsletter styling
-- decision only and must NEVER bleed into the gallery view (which
-- keeps the photo at its natural aspect).
--
-- One row per photo. Referenced by photo_id (event_photos.id). Values
-- are 0-100 percentages of the source image dimensions.

CREATE TABLE IF NOT EXISTS newsletter_photo_crops (
  photo_id   INTEGER PRIMARY KEY REFERENCES event_photos(id) ON DELETE CASCADE,
  crop_x     NUMERIC(5,2) NOT NULL,
  crop_y     NUMERIC(5,2) NOT NULL,
  crop_w     NUMERIC(5,2) NOT NULL,
  crop_h     NUMERIC(5,2) NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Migrate any crops that were briefly persisted on event_photos
-- during the 108 iteration to their new home, then drop the columns
-- so nothing (accidentally or otherwise) reads them from the gallery
-- table.
INSERT INTO newsletter_photo_crops (photo_id, crop_x, crop_y, crop_w, crop_h)
SELECT id, crop_x, crop_y, crop_w, crop_h
FROM event_photos
WHERE crop_x IS NOT NULL
  AND crop_y IS NOT NULL
  AND crop_w IS NOT NULL
  AND crop_h IS NOT NULL
ON CONFLICT (photo_id) DO NOTHING;

ALTER TABLE event_photos DROP COLUMN IF EXISTS crop_x;
ALTER TABLE event_photos DROP COLUMN IF EXISTS crop_y;
ALTER TABLE event_photos DROP COLUMN IF EXISTS crop_w;
ALTER TABLE event_photos DROP COLUMN IF EXISTS crop_h;
ALTER TABLE event_photos DROP COLUMN IF EXISTS focal_x;
ALTER TABLE event_photos DROP COLUMN IF EXISTS focal_y;
