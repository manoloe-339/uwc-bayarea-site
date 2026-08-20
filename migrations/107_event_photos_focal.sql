-- Per-photo focal point (0–100% x/y) for newsletter cell centering.
-- NULL = default 50/50 (photo center). Populated on-demand from the
-- compose page's "Adjust photographs" modal — never bulk-backfilled.
-- Also reused across future newsletters so the admin only has to
-- re-center a given photo once.
ALTER TABLE event_photos
  ADD COLUMN IF NOT EXISTS focal_x NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS focal_y NUMERIC(5,2);
