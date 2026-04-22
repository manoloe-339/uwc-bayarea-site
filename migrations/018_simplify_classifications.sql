-- Drop redundant company-classification columns. Claude reasons about
-- subsidiary / public-trading status internally when answering "is this a
-- startup" — we don't need to store them separately. Keeps the review UI
-- and upsert path lean.

ALTER TABLE company_classifications DROP COLUMN IF EXISTS is_public;
ALTER TABLE company_classifications DROP COLUMN IF EXISTS is_subsidiary;
ALTER TABLE company_classifications DROP COLUMN IF EXISTS parent_company;
