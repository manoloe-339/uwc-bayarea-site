-- Singleton configuration row used by the newsletter email template + admin
-- settings page. One row per installation.
CREATE TABLE IF NOT EXISTS site_settings (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  logo_url                    TEXT,
  footer_tagline              TEXT DEFAULT 'A UWC Initiative',
  physical_address            TEXT,
  whatsapp_url                TEXT,
  whatsapp_default_headline   TEXT DEFAULT 'Join the WhatsApp community',
  whatsapp_default_body       TEXT DEFAULT 'Stay in the loop with Bay Area UWC alumni. Announcements, carpools, and conversations.',
  whatsapp_default_cta_label  TEXT DEFAULT 'Join WhatsApp',
  foodies_default_headline    TEXT DEFAULT 'UWC Foodies',
  foodies_default_body        TEXT DEFAULT 'Informal gatherings sharing food across the Bay Area, rotating locations monthly.',
  foodies_default_cta_label   TEXT DEFAULT 'Learn more',
  foodies_default_cta_url     TEXT,
  default_from_name           TEXT DEFAULT 'UWC Bay Area',
  updated_at                  TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO site_settings (id, logo_url, physical_address)
SELECT
  gen_random_uuid(),
  'https://uwcbayarea.org/uwc-logo-white.png',
  '339 Dolan Avenue, Mill Valley, CA, 94941'
WHERE NOT EXISTS (SELECT 1 FROM site_settings);
