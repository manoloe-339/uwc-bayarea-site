-- Optional photo backdrop for the Foodies card on the homepage.
-- Used when card_backdrop = 'photo'. Admin uploads a photo via the
-- event photos admin (or any image host) and pastes the URL here.
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS card_backdrop_image_url TEXT;
