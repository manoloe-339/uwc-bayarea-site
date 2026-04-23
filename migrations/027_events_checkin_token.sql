-- Token-based access to the volunteer check-in page. No login required —
-- the token in the URL IS the auth. Optional 4-digit PIN for an extra gate;
-- plaintext because it's just a physical-event gatekeeper, not a credential.

ALTER TABLE events ADD COLUMN IF NOT EXISTS checkin_token TEXT UNIQUE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS checkin_pin TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS checkin_token_generated_at TIMESTAMPTZ;

-- Enable unaccent for diacritic-insensitive last-name search. Neon supports
-- this. If the environment doesn't, the app falls back to JS-side
-- normalization (see lib/checkin.ts).
CREATE EXTENSION IF NOT EXISTS unaccent;
