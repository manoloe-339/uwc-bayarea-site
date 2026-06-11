-- Marks an alumni record's photo as admin-curated. When TRUE, the
-- LinkedIn enrichment pipeline must NOT overwrite photo_url on a
-- re-enrich pass. Default FALSE preserves the existing behavior for
-- every row — scraped or empty — until an admin uploads a photo
-- through /admin/alumni/[id], at which point we flip the flag.
ALTER TABLE alumni
  ADD COLUMN IF NOT EXISTS photo_locked BOOLEAN NOT NULL DEFAULT FALSE;
