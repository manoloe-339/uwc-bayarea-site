-- Curated asset tables that feed the /directory/login backdrop.
--
-- Two tables for two distinct admin workflows:
--
--   1. `uwc_assets` — one row per canonical UWC (19 schools incl. the
--      closed Simón Bolívar). Three nullable slots per school: a
--      logo, a campus photo, and an "other" photo. Lets us curate
--      exactly which image represents each UWC on the login page.
--
--   2. `login_assets` — free-form library of additional non-UWC
--      visuals (university logos, company logos, country flags).
--      Each row carries a `kind` so the login backdrop can sample
--      from each category at the right ratio.
--
-- Vercel Blob hosts the actual image files; these tables store URLs.

CREATE TABLE IF NOT EXISTS uwc_assets (
  canonical    TEXT PRIMARY KEY,
  logo_url     TEXT,
  campus_url   TEXT,
  other_url    TEXT,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS login_assets (
  id            SERIAL PRIMARY KEY,
  kind          TEXT NOT NULL CHECK (kind IN ('university_logo','company_logo','flag')),
  label         TEXT NOT NULL,
  image_url     TEXT NOT NULL,
  display_order INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS login_assets_kind_idx
  ON login_assets (kind, display_order);

-- Seed uwc_assets with the 18 LinkedIn-derived logos already on file.
-- The login page used to hardcode this list as the UWC_LOGOS constant
-- in components/login/faces-shared.ts; the admin tool can now swap
-- any of these out without a code change.
INSERT INTO uwc_assets (canonical, logo_url) VALUES
  ('UWC Atlantic',             'https://hxdqmbnanbxucbqd.public.blob.vercel-storage.com/logos/6b3cd189bab61b317c7e6aba.jpg'),
  ('UWC Pearson',              'https://hxdqmbnanbxucbqd.public.blob.vercel-storage.com/logos/f9a5c7159703e6a3068a5999.jpg'),
  ('UWC USA',                  'https://hxdqmbnanbxucbqd.public.blob.vercel-storage.com/logos/db9ec0624929ebc519c29e04.jpg'),
  ('UWC Adriatic',             'https://hxdqmbnanbxucbqd.public.blob.vercel-storage.com/logos/6dafe4f483023b19277a7c5e.jpg'),
  ('UWC Red Cross Nordic',     'https://hxdqmbnanbxucbqd.public.blob.vercel-storage.com/logos/b56648ffabea7d1d0446dd2a.jpg'),
  ('UWC Mahindra',             'https://hxdqmbnanbxucbqd.public.blob.vercel-storage.com/logos/a75ec6c3fca5080bb1b8b4fa.jpg'),
  ('UWC Costa Rica',           'https://hxdqmbnanbxucbqd.public.blob.vercel-storage.com/logos/445b0c0de0340c671e7dd26b.jpg'),
  ('UWC Waterford Kamhlaba',   'https://hxdqmbnanbxucbqd.public.blob.vercel-storage.com/logos/87ab45f3da11473dc8febf48.jpg'),
  ('UWC Mostar',               'https://hxdqmbnanbxucbqd.public.blob.vercel-storage.com/logos/9338f94c5b8c99da0087622a.jpg'),
  ('UWC Li Po Chun',           'https://hxdqmbnanbxucbqd.public.blob.vercel-storage.com/logos/00995ff3317fbad58dd78fd2.jpg'),
  ('UWC Robert Bosch College', 'https://hxdqmbnanbxucbqd.public.blob.vercel-storage.com/logos/f4bced753e49ea2af9cea165.jpg'),
  ('UWC Dilijan',              'https://hxdqmbnanbxucbqd.public.blob.vercel-storage.com/logos/ac8df365daaa8aa7d801b695.jpg'),
  ('UWC Maastricht',           'https://hxdqmbnanbxucbqd.public.blob.vercel-storage.com/logos/a504264cd4e735f5438e533e.jpg'),
  ('UWC Changshu China',       'https://hxdqmbnanbxucbqd.public.blob.vercel-storage.com/logos/9449bd9b4bed3f7d7d897adf.jpg'),
  ('UWC Thailand',             'https://hxdqmbnanbxucbqd.public.blob.vercel-storage.com/logos/92a260ec58266a951ee427e9.jpg'),
  ('UWC ISAK Japan',           'https://hxdqmbnanbxucbqd.public.blob.vercel-storage.com/logos/ebcf4f8721a49b331ecefe4e.jpg'),
  ('UWC South East Asia',      'https://hxdqmbnanbxucbqd.public.blob.vercel-storage.com/logos/1a07b264c0f6b2a17179c71a.jpg'),
  ('UWC East Africa',          'https://hxdqmbnanbxucbqd.public.blob.vercel-storage.com/logos/1b3112dbe9fc890e6c9d0632.jpg')
ON CONFLICT (canonical) DO NOTHING;
