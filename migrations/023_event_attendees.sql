-- Per-event attendee records. One row per Stripe checkout session or per
-- special guest. alumni_id is nullable: rows for unmatched purchases or
-- external guests don't need an alumni row.

CREATE TABLE IF NOT EXISTS event_attendees (
  id SERIAL PRIMARY KEY,
  event_id INT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  alumni_id INT REFERENCES alumni(id) ON DELETE SET NULL,

  -- 'paid' (Stripe), 'comp' (special guest / free), 'walk-in' (added at door).
  attendee_type TEXT NOT NULL DEFAULT 'paid',

  -- Stripe identifiers. UNIQUE because the same session should never be
  -- imported twice on a re-sync.
  stripe_session_id TEXT UNIQUE,
  stripe_payment_intent_id TEXT,
  stripe_customer_email TEXT,
  stripe_customer_name TEXT,
  stripe_custom_fields JSONB,
  amount_paid NUMERIC(10, 2) NOT NULL DEFAULT 0,
  paid_at TIMESTAMPTZ,

  -- Soft-mark on refund, preserves history. NULL = not refunded.
  refund_status TEXT,

  -- Matching metadata: 'pending' while unmatched, 'matched' once linked,
  -- 'needs_review' for medium/low confidence, 'unmatched' when no candidate.
  match_status TEXT NOT NULL DEFAULT 'pending',
  match_confidence TEXT, -- 'high' | 'medium' | 'low' | 'manual' | NULL
  match_reason TEXT,
  matched_at TIMESTAMPTZ,

  -- Admin annotations.
  notes TEXT,
  is_starred BOOLEAN NOT NULL DEFAULT FALSE,
  needs_followup BOOLEAN NOT NULL DEFAULT FALSE,

  -- Check-in (Part 3).
  checked_in BOOLEAN NOT NULL DEFAULT FALSE,
  checked_in_at TIMESTAMPTZ,
  checked_in_by TEXT,

  -- QR code (Part 2).
  qr_code_data TEXT UNIQUE,
  qr_code_sent_at TIMESTAMPTZ,

  -- Soft delete: admin removed this row. Sync won't resurrect it.
  deleted_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS event_attendees_event_idx ON event_attendees(event_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS event_attendees_alumni_idx ON event_attendees(alumni_id);
CREATE INDEX IF NOT EXISTS event_attendees_match_status_idx ON event_attendees(event_id, match_status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS event_attendees_starred_idx ON event_attendees(event_id) WHERE is_starred AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS event_attendees_followup_idx ON event_attendees(event_id) WHERE needs_followup AND deleted_at IS NULL;
