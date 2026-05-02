-- Hosts on Foodies meals are alumni records, not free text — so the
-- homepage card can show their photo, name, and grad year by joining
-- to the alumni table. Drop the text columns added in 059 and replace
-- with nullable FKs to alumni(id). No data loss because no Foodies
-- events have been created yet.
ALTER TABLE events
  DROP COLUMN IF EXISTS foodies_host_1,
  DROP COLUMN IF EXISTS foodies_host_2,
  ADD COLUMN IF NOT EXISTS foodies_host_1_alumni_id INTEGER REFERENCES alumni(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS foodies_host_2_alumni_id INTEGER REFERENCES alumni(id) ON DELETE SET NULL;
