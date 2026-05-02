-- Optional editorial description for the public event gallery page.
-- Stored as a tiny markdown subset (paragraphs, bold, italic, links).
-- Renders above the photo grid on /events/[slug]/photos.
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS gallery_description_md TEXT;
