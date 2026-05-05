-- 1. Backfill submitted_at for /signup form rows.
--
-- Historically, alumni.submitted_at was only populated by the Google
-- Form CSV import path. Rows created via the website /signup form
-- (sources contains 'signup_form') had submitted_at = NULL, leaving
-- dashboard counts and several display strings ("Record #N · submitted
-- X") working only for the legacy import path. Same fix-forward will
-- write submitted_at = NOW() in app/signup/actions.ts going forward;
-- this UPDATE handles the rows already in the table.
UPDATE alumni
SET submitted_at = imported_at
WHERE 'signup_form' = ANY(sources) AND submitted_at IS NULL;

-- 2. Remove the duplicate Ivy Tirok request row created when the
-- pre-tracker migrate.mjs re-ran migration 081 during dashboard work.
-- The legitimate row (id=1) was sent on May 4 evening Pacific; the
-- duplicate (id=2) was inserted directly via the migration script's
-- second invocation on May 5 mid-morning, never via the homepage
-- modal. No outbound email was triggered for the duplicate, since the
-- migration backfill bypasses sendRegisteredAlumRequest. Migrations
-- 081 has been kept idempotent in spirit by the new _migrations
-- tracker, but we still need to clean up the existing dupe.
DELETE FROM registered_whatsapp_requests
WHERE alumni_id = 388
  AND raw_name = 'Ivy Tirok'
  AND sent_at IS NULL;
