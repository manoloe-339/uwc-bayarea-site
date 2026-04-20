-- Backfill fix: during earlier imports, full names were put into `last_name`
-- with `first_name` left NULL. Split them: first whitespace-delimited token
-- → first_name, the remainder → last_name. Rows already populated (both
-- fields set) are untouched.
--
-- Two sub-cases both handled by the same expression:
--   * "Michelle Yuxin Wang" → first=Michelle, last="Yuxin Wang"
--   * "Htet"                → first=Htet,    last=NULL (single-token, was a first name)
--
UPDATE alumni
SET
  first_name = regexp_replace(last_name, '^(\S+).*$', '\1'),
  last_name  = NULLIF(regexp_replace(last_name, '^\S+\s*(.*)$', '\1'), ''),
  updated_at = NOW()
WHERE first_name IS NULL
  AND last_name IS NOT NULL;
