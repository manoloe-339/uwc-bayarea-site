-- Subscription + unsubscribe state on the alumni row.
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS subscribed          BOOLEAN     DEFAULT TRUE;
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS unsubscribed_at     TIMESTAMPTZ;
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS unsubscribe_reason  TEXT;
ALTER TABLE alumni ADD COLUMN IF NOT EXISTS unsubscribe_note    TEXT;
UPDATE alumni SET subscribed = TRUE WHERE subscribed IS NULL;
CREATE INDEX IF NOT EXISTS alumni_subscribed_idx ON alumni (subscribed);

-- Full history of unsubscribe (+ resubscribe) events.
CREATE TABLE IF NOT EXISTS unsubscribe_events (
  id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  alumni_id  INTEGER      NOT NULL REFERENCES alumni(id) ON DELETE CASCADE,
  event_type TEXT         NOT NULL DEFAULT 'unsubscribe',
  reason     TEXT,
  note       TEXT,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS unsubscribe_events_alumni_idx ON unsubscribe_events (alumni_id);
CREATE INDEX IF NOT EXISTS unsubscribe_events_created_idx ON unsubscribe_events (created_at DESC);

-- Email campaigns (one row per "send" action from the admin UI).
CREATE TABLE IF NOT EXISTS email_campaigns (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  subject          TEXT         NOT NULL,
  body             TEXT         NOT NULL,
  filter_snapshot  JSONB        NOT NULL DEFAULT '{}'::jsonb,
  recipient_count  INTEGER      NOT NULL DEFAULT 0,
  sent_count       INTEGER      NOT NULL DEFAULT 0,
  failed_count     INTEGER      NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  created_by       TEXT
);

-- Per-recipient delivery row. Populated during send; later updated by webhooks.
CREATE TABLE IF NOT EXISTS email_sends (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id         UUID         REFERENCES email_campaigns(id) ON DELETE CASCADE,
  alumni_id           INTEGER      REFERENCES alumni(id) ON DELETE SET NULL,
  email               TEXT         NOT NULL,
  subject             TEXT,
  body                TEXT,
  resend_message_id   TEXT,
  status              TEXT         NOT NULL DEFAULT 'pending',
  error               TEXT,
  sent_at             TIMESTAMPTZ,
  opened_at           TIMESTAMPTZ,
  clicked_at          TIMESTAMPTZ,
  bounced_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS email_sends_campaign_idx  ON email_sends (campaign_id);
CREATE INDEX IF NOT EXISTS email_sends_message_idx   ON email_sends (resend_message_id);
CREATE INDEX IF NOT EXISTS email_sends_alumni_idx    ON email_sends (alumni_id);
