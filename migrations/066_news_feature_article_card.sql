-- Optional article preview card on news features. When article_image_url
-- is set, render a clickable card showing the article's preview image
-- (typically the og:image URL admins grab from the article). Style is
-- one of two looks the admin picks per feature: 'clean' or 'clipping'.
ALTER TABLE news_features
  ADD COLUMN IF NOT EXISTS article_image_url   TEXT,
  ADD COLUMN IF NOT EXISTS article_card_style  TEXT NOT NULL DEFAULT 'clean';
