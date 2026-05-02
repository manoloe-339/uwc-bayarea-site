-- Editorial hero carousel for the new homepage. Each row is one slide.
-- Slides usually point at an event (so the CTA link + cover image can
-- be derived), but the copy fields (eyebrow / title / emphasis / byline
-- / cta) are admin-curated. image_url overrides the event's cover.
CREATE TABLE IF NOT EXISTS homepage_hero_slides (
  id          SERIAL PRIMARY KEY,
  event_id    INTEGER REFERENCES events(id) ON DELETE SET NULL,
  eyebrow     TEXT,
  title       TEXT NOT NULL,
  emphasis    TEXT,
  byline      TEXT,
  cta_label   TEXT,
  cta_href    TEXT,
  image_url   TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  enabled     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS homepage_hero_slides_active_sort_idx
  ON homepage_hero_slides (sort_order ASC, id ASC)
  WHERE enabled = TRUE;
