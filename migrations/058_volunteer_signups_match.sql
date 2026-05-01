-- Mirror the matching state machine used on event_attendees so the
-- /admin/help-out triage flow is consistent with /admin/events/[slug]/
-- attendees: matched | needs_review | unmatched, with confidence and a
-- short human reason for the audit trail.
ALTER TABLE volunteer_signups
  ADD COLUMN IF NOT EXISTS match_status TEXT,
  ADD COLUMN IF NOT EXISTS match_confidence TEXT,
  ADD COLUMN IF NOT EXISTS match_reason TEXT,
  ADD COLUMN IF NOT EXISTS matched_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS volunteer_signups_status_idx
  ON volunteer_signups(match_status);
