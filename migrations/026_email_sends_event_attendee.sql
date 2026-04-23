-- Allow email_sends to reference an event_attendees row instead of an
-- alumni row. Used by signup-invite emails sent to Stripe purchasers who
-- aren't yet in the alumni database. alumni_id is already nullable
-- (test sends set it NULL), so we only need to add the new FK.

ALTER TABLE email_sends
  ADD COLUMN IF NOT EXISTS event_attendee_id INT REFERENCES event_attendees(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS email_sends_attendee_idx
  ON email_sends (event_attendee_id)
  WHERE event_attendee_id IS NOT NULL;

-- Deliberately no CHECK that exactly one of (alumni_id, event_attendee_id)
-- is set: existing test sends legitimately leave both NULL (see
-- lib/campaign-send.ts test path). Invite inserts will always supply
-- event_attendee_id; campaign/newsletter inserts keep alumni_id.
