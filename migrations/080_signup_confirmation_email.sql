-- Admin-editable signup confirmation email. Subject is plain text;
-- body is a tiny markdown subset (paragraphs, **bold**, *italic*,
-- [text](url)) rendered via lib/simple-markdown into the standard
-- email chrome. Both nullable — when blank, the signup action falls
-- back to the hardcoded default copy in app/signup/actions.ts so
-- nothing breaks if a fresh deploy lands before admin customises.
ALTER TABLE site_settings
  ADD COLUMN IF NOT EXISTS signup_confirmation_subject TEXT,
  ADD COLUMN IF NOT EXISTS signup_confirmation_body_md TEXT;
