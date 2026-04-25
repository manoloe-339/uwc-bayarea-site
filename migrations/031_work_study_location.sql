-- Where the alum works / studies, separate from their home current_city.
-- Both nullable; signup form leaves them blank when the alum doesn't
-- check the working / studying boxes.

ALTER TABLE alumni ADD COLUMN IF NOT EXISTS work_location TEXT;
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS study_location TEXT;
