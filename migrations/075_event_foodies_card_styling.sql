-- Visual personalization for Foodies cards on the homepage:
--   cuisine_country  → canonical country name (from lib/countries.ts list).
--                       The flag emoji is derived at render time.
--   cuisine_emoji    → free-text override (admin types any emoji).
--                       Wins over cuisine_country when both are set.
--   card_backdrop    → 'none' | 'region_tint' | 'cuisine_flag'
--                       Choice of card-level visual treatment.
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS cuisine_country TEXT,
  ADD COLUMN IF NOT EXISTS cuisine_emoji   TEXT,
  ADD COLUMN IF NOT EXISTS card_backdrop   TEXT NOT NULL DEFAULT 'none';
