-- Reasons become a multi-select: a single save can now claim more
-- than one motivation (e.g. "Want to meet" + "Referral"). Migrate the
-- one-value `reason` column into an array `reasons` and drop the old
-- column. The retired 'mentor' value (removed last week) has already
-- been swept out, so nothing to clean up there.
ALTER TABLE directory_saves
  ADD COLUMN IF NOT EXISTS reasons TEXT[] NOT NULL DEFAULT '{}';

UPDATE directory_saves
   SET reasons = ARRAY[reason]
 WHERE reason IS NOT NULL AND array_length(reasons, 1) IS NULL;

ALTER TABLE directory_saves
  DROP COLUMN IF EXISTS reason;
