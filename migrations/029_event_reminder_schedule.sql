-- Admin-chosen send time for the bulk reminder email. The existing
-- Vercel Cron (/api/cron/send-scheduled, every 5 min) fires
-- sendRemindersForEvent once reminder_scheduled_at is in the past and
-- reminder_auto_sent_at hasn't yet been stamped.
--
-- Manual "Send reminder emails" still works at any time and is
-- independent of these fields.

ALTER TABLE events ADD COLUMN IF NOT EXISTS reminder_scheduled_at TIMESTAMPTZ;
ALTER TABLE events ADD COLUMN IF NOT EXISTS reminder_auto_sent_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS events_reminder_due_idx
  ON events (reminder_scheduled_at)
  WHERE reminder_scheduled_at IS NOT NULL AND reminder_auto_sent_at IS NULL;
