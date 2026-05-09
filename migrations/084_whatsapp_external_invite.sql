-- Track requests that the admin closes manually because the invite was
-- already sent outside this tool (e.g. over text/WhatsApp directly).
-- Distinct from sent_at so engagement tracking (open/click/bounce) is
-- suppressed for these and the listing can label them differently.
ALTER TABLE registered_whatsapp_requests
  ADD COLUMN IF NOT EXISTS external_invite_at TIMESTAMPTZ;
