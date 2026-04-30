-- Per-event layout choice for the printable name tags. Applies to every
-- tag in the event. Composer preview + print page both read this.
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS name_tag_layout TEXT NOT NULL DEFAULT 'standard'
    CHECK (name_tag_layout IN ('standard', 'first-emphasis'));
