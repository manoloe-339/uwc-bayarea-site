-- Admin-editable copy for the /signup/thanks confirmation page,
-- mirroring the signup-email tool. Four fields: eyebrow, headline,
-- markdown body (one blob, blank-line-separated paragraphs), and
-- the back-to-home button label. NULL → fall back to the default
-- copy baked into lib/settings.ts.
ALTER TABLE site_settings
  ADD COLUMN IF NOT EXISTS signup_thanks_eyebrow      TEXT,
  ADD COLUMN IF NOT EXISTS signup_thanks_headline     TEXT,
  ADD COLUMN IF NOT EXISTS signup_thanks_body_md      TEXT,
  ADD COLUMN IF NOT EXISTS signup_thanks_button_label TEXT;
