-- Persistent voice/style guide for the AI newsletter composer. Fed
-- into the system prompt on every chat turn so Claude doesn't have
-- to relearn tone from scratch. Admin edits from /admin/email/settings.
ALTER TABLE site_settings
  ADD COLUMN IF NOT EXISTS newsletter_style_guide TEXT;
