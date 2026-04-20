-- Phase 2b Checkpoint F: extend the campaigns + sends schema for the richer
-- newsletter flow, add hard-bounce quarantine on alumni, and enforce
-- per-recipient idempotency on (campaign_id, alumni_id).

-- ---------- alumni ----------
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS email_invalid BOOLEAN DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS alumni_email_invalid_idx ON alumni (email_invalid);

-- ---------- email_campaigns ----------
ALTER TABLE email_campaigns ADD COLUMN IF NOT EXISTS format         TEXT DEFAULT 'quick_note';
ALTER TABLE email_campaigns ADD COLUMN IF NOT EXISTS mode           TEXT;
ALTER TABLE email_campaigns ADD COLUMN IF NOT EXISTS content_json   JSONB;
ALTER TABLE email_campaigns ADD COLUMN IF NOT EXISTS preheader      TEXT;
ALTER TABLE email_campaigns ADD COLUMN IF NOT EXISTS from_name      TEXT;
ALTER TABLE email_campaigns ADD COLUMN IF NOT EXISTS status         TEXT DEFAULT 'sent';
ALTER TABLE email_campaigns ADD COLUMN IF NOT EXISTS scheduled_for  TIMESTAMPTZ;
ALTER TABLE email_campaigns ADD COLUMN IF NOT EXISTS sent_at        TIMESTAMPTZ;
ALTER TABLE email_campaigns ADD COLUMN IF NOT EXISTS duplicated_from_id UUID REFERENCES email_campaigns(id);

-- Existing rows are all completed sends from the quick-note flow, mark them accordingly.
UPDATE email_campaigns SET format = 'quick_note' WHERE format IS NULL;
UPDATE email_campaigns SET status = 'sent' WHERE status IS NULL;
UPDATE email_campaigns SET sent_at = created_at WHERE sent_at IS NULL AND status = 'sent';

CREATE INDEX IF NOT EXISTS email_campaigns_status_sched_idx
  ON email_campaigns (status, scheduled_for)
  WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS email_campaigns_status_idx ON email_campaigns (status);

-- ---------- email_sends ----------
ALTER TABLE email_sends ADD COLUMN IF NOT EXISTS delivered_at  TIMESTAMPTZ;
-- bounce_type is 'hard' | 'soft' per Resend webhook data.
ALTER TABLE email_sends ADD COLUMN IF NOT EXISTS bounce_type   TEXT;
ALTER TABLE email_sends ADD COLUMN IF NOT EXISTS bounce_reason TEXT;
ALTER TABLE email_sends ADD COLUMN IF NOT EXISTS is_test       BOOLEAN DEFAULT FALSE;
ALTER TABLE email_sends ADD COLUMN IF NOT EXISTS complained_at TIMESTAMPTZ;

-- Dedupe existing (campaign_id, alumni_id) pairs before adding the unique index.
-- Keep the earliest row per (campaign_id, alumni_id) by (created_at, id), drop the rest.
DELETE FROM email_sends
WHERE id IN (
  SELECT s.id FROM email_sends s
  WHERE s.campaign_id IS NOT NULL
    AND s.alumni_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM email_sends s2
      WHERE s2.campaign_id = s.campaign_id
        AND s2.alumni_id = s.alumni_id
        AND s2.id <> s.id
        AND (s2.created_at, s2.id) < (s.created_at, s.id)
    )
);

-- Partial-unique index so NULL alumni_id (rare, for anonymous sends) doesn't trip it.
CREATE UNIQUE INDEX IF NOT EXISTS email_sends_campaign_alumni_uidx
  ON email_sends (campaign_id, alumni_id)
  WHERE campaign_id IS NOT NULL AND alumni_id IS NOT NULL;
