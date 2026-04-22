-- Distinguish campaign sends from ad-hoc admin 1:1 sends. All existing rows
-- are campaign sends (the default covers them retroactively). Ad-hoc sends
-- have campaign_id = NULL and kind = 'ad_hoc'.

ALTER TABLE email_sends ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'campaign';
CREATE INDEX IF NOT EXISTS email_sends_kind_idx ON email_sends (kind);
