-- Admin-only flag: the admin has manually confirmed this person has no
-- discoverable public LinkedIn profile. Used to distinguish "haven't looked
-- yet" from "looked, doesn't exist".

ALTER TABLE alumni
  ADD COLUMN IF NOT EXISTS no_linkedin_confirmed BOOLEAN NOT NULL DEFAULT FALSE;
