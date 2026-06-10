-- Migration 092 seeded two UWCs with the wrong canonical names:
--   "UWC Atlantic"  (canonical in lib/uwc-colleges is "UWC Atlantic College")
--   "UWC Pearson"   (canonical in lib/uwc-colleges is "UWC Pearson College")
--
-- The admin tool iterates the canonical list to render its grid, so
-- when an admin uploaded a new logo via the "UWC Atlantic College"
-- card the INSERT created a SECOND row with the correct canonical
-- name. The login page then saw both rows in uwc_assets and rendered
-- two tiles per UWC (the LinkedIn-served one AND the admin-uploaded
-- one) — Manolo spotted Pearson showing two different logos on the
-- backdrop.
--
-- Cleanup strategy:
--   1. If the *correct* canonical row exists, drop the wrong one
--      (admin upload wins; that's the curated asset).
--   2. If the wrong canonical row exists alone (the admin hasn't
--      uploaded a replacement yet), update its canonical to the
--      correct one so a future upload finds the same row instead of
--      creating a duplicate.
--
-- Doing this twice is harmless: the IS NOT NULL guards make the
-- migration idempotent.

-- Atlantic
DELETE FROM uwc_assets
WHERE canonical = 'UWC Atlantic'
  AND EXISTS (
    SELECT 1 FROM uwc_assets WHERE canonical = 'UWC Atlantic College'
  );
UPDATE uwc_assets SET canonical = 'UWC Atlantic College'
WHERE canonical = 'UWC Atlantic';

-- Pearson
DELETE FROM uwc_assets
WHERE canonical = 'UWC Pearson'
  AND EXISTS (
    SELECT 1 FROM uwc_assets WHERE canonical = 'UWC Pearson College'
  );
UPDATE uwc_assets SET canonical = 'UWC Pearson College'
WHERE canonical = 'UWC Pearson';
