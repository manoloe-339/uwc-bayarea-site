-- Distinguish "event row last edited" from "Stripe sync last ran".
-- updated_at bumps on any edit, which misleads the admin into thinking
-- a sync has run when it hasn't.
ALTER TABLE events ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;
