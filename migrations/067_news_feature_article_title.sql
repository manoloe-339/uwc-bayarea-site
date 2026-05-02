-- Optional admin-curated article title for the news preview card.
-- Renders in the card caption between publication/date and the
-- "Read the article →" affordance.
ALTER TABLE news_features
  ADD COLUMN IF NOT EXISTS article_title TEXT;
