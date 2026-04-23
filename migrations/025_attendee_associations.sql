-- Extra attendee context separate from the Stripe match:
--
-- * associated_with_alumni_id — "this person is here with/because of this
--   alumnus" (e.g. a partner, friend, or family member of an alum). Distinct
--   from alumni_id (which says "this attendee IS this alum").
-- * relationship_type — free-text but UI offers a canonical dropdown.
-- * is_potential_donor — admin flag surfaced in display + CSV.
-- * signup_invite_sent_at — latest send timestamp for "invite to join the
--   alumni DB" email (can be overwritten on resend).

ALTER TABLE event_attendees
  ADD COLUMN IF NOT EXISTS associated_with_alumni_id INT REFERENCES alumni(id) ON DELETE SET NULL;
ALTER TABLE event_attendees
  ADD COLUMN IF NOT EXISTS relationship_type TEXT;
ALTER TABLE event_attendees
  ADD COLUMN IF NOT EXISTS is_potential_donor BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE event_attendees
  ADD COLUMN IF NOT EXISTS signup_invite_sent_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS event_attendees_associated_idx
  ON event_attendees (associated_with_alumni_id)
  WHERE associated_with_alumni_id IS NOT NULL;
