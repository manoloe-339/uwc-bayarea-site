-- Ticket events (distinct from invite lists — this table tracks real
-- paid events backed by a Stripe Payment Link).

CREATE TABLE IF NOT EXISTS events (
  id SERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  date DATE NOT NULL,
  time TEXT,
  location TEXT,
  description TEXT,

  stripe_payment_link_id TEXT,
  stripe_price_id TEXT,
  ticket_price NUMERIC(10, 2),

  -- Recomputed on every Stripe sync.
  total_tickets_sold INT NOT NULL DEFAULT 0,
  total_revenue NUMERIC(10, 2) NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS events_date_idx ON events (date);

-- Backfill the May 1 dinner so the initial sync has a target.
INSERT INTO events (slug, name, date, time, location, stripe_payment_link_id, ticket_price)
VALUES (
  'may-1-2026-dinner',
  'May 1 Tech Leadership Dinner',
  '2026-05-01',
  '6:30 PM',
  'TBD',
  'plink_1TMhRkF7OGSslLNj5jCxpYs7',
  50.00
)
ON CONFLICT (slug) DO NOTHING;
