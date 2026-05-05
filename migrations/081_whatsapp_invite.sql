-- Registered-alum WhatsApp join requests. Persisted so admin can
-- track who's asked and whether the join email has gone out (in
-- addition to the per-request email notification that already fires).
--
-- alumni_id is nullable: the homepage modal only collects a free-text
-- name, so when there's a single unambiguous match we link to that
-- alumni row. Multiple- or no-match requests stay unlinked and the
-- admin disambiguates from the candidate list in the email.
CREATE TABLE IF NOT EXISTS registered_whatsapp_requests (
  id          SERIAL PRIMARY KEY,
  alumni_id   INTEGER REFERENCES alumni(id) ON DELETE SET NULL,
  raw_name    TEXT NOT NULL,
  sent_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS registered_whatsapp_requests_created_at_idx
  ON registered_whatsapp_requests (created_at DESC);
CREATE INDEX IF NOT EXISTS registered_whatsapp_requests_alumni_id_idx
  ON registered_whatsapp_requests (alumni_id);

-- Admin-editable WhatsApp invite email. Subject is plain text; body
-- is a tiny markdown subset rendered through lib/simple-markdown into
-- the standard email chrome. Both nullable — when blank, the send
-- action falls back to DEFAULT_WHATSAPP_INVITE in lib/settings.ts.
ALTER TABLE site_settings
  ADD COLUMN IF NOT EXISTS whatsapp_invite_subject TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_invite_body_md TEXT;

-- Backfill: Ivy Tirok's request came in before this admin tool
-- existed and hasn't been sent the join link yet. Match on name
-- against the alumni table; skip silently if nothing matches.
INSERT INTO registered_whatsapp_requests (alumni_id, raw_name, created_at)
SELECT id, 'Ivy Tirok', NOW()
FROM alumni
WHERE deceased IS NOT TRUE
  AND lower(first_name) LIKE '%ivy%'
  AND lower(last_name) LIKE '%tirok%'
ORDER BY id
LIMIT 1
ON CONFLICT DO NOTHING;
