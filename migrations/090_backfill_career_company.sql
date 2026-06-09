-- Backfill alumni_career.company from company_linkedin_url for rows
-- where the LinkedIn enrichment populated the URL but dropped the
-- name. The slug-to-name conversion mirrors what the transformer now
-- does at write time (deriveCompanyFromLinkedinUrl):
--   "the-world-bank-group" → "The World Bank Group"
-- Done in SQL so future scrapes don't have to depend on a one-off
-- script. Only touches rows that have NULL company AND a usable URL.
UPDATE alumni_career
SET company = (
  -- 1. Extract the slug after /company/ (handles trailing slash, query,
  --    fragment).
  -- 2. Replace dashes with spaces.
  -- 3. INITCAP gives Title Case ("the world bank group" → "The World
  --    Bank Group"). It's not perfect for acronyms ("Citi" → "Citi"
  --    fine; "IBM" → "Ibm" — acceptable; admin can fix outliers).
  INITCAP(
    REPLACE(
      regexp_replace(
        company_linkedin_url,
        '.*/company/([^/?#]+).*',
        '\1'
      ),
      '-',
      ' '
    )
  )
)
WHERE company IS NULL
  AND company_linkedin_url IS NOT NULL
  AND company_linkedin_url ~* '/company/[^/?#]+';
