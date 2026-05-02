-- Optional publication logo URL for the article preview card.
-- When null, the public render falls back to Google's favicon service
-- using the article_url's domain. Admin override exists for cases
-- where the favicon is too small / wrong (e.g. brand image they want
-- shown instead).
ALTER TABLE news_features
  ADD COLUMN IF NOT EXISTS publication_logo_url TEXT;
