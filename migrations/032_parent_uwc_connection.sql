-- For signups with affiliation='Parent': capture which UWC their child
-- attended (or is attending). Distinct from the alum-self uwc_college /
-- grad_year columns so admin can tell whether the row is an alum, a
-- parent, or both.

ALTER TABLE alumni ADD COLUMN IF NOT EXISTS parent_of_name TEXT;
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS parent_of_uwc_college TEXT;
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS parent_of_grad_year INT;
