-- The WhatsApp invite email body had a hardcoded chat.whatsapp.com URL
-- (spammers found it). The template supports a {whatsapp_url}
-- placeholder that substitutes from site_settings.whatsapp_url at send
-- time, but the DB row was never migrated to use it — so rotating the
-- URL required editing two fields instead of one.
--
-- Surgical REPLACE against the compromised link so the invite body
-- reads "[UWC Bay Area WhatsApp]({whatsapp_url})" and the URL becomes
-- one-field-change-only going forward. Idempotent: if the old URL is
-- already gone, this is a no-op.
UPDATE site_settings
SET whatsapp_invite_body_md = REPLACE(
      whatsapp_invite_body_md,
      '[UWC Bay Area WhatsApp](https://chat.whatsapp.com/HZFshwoWQlxCmhjBqaRW5w)',
      '[UWC Bay Area WhatsApp]({whatsapp_url})'
    )
WHERE whatsapp_invite_body_md LIKE '%HZFshwoWQlxCmhjBqaRW5w%';
