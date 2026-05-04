-- "Just visiting" WhatsApp access requests submitted via the
-- homepage WhatsApp band modal. Persisted so admin can review the
-- running list at /admin/tools/visiting (in addition to the email
-- notification that goes out on each submission).
CREATE TABLE IF NOT EXISTS visiting_requests (
  id           SERIAL PRIMARY KEY,
  first_name   TEXT NOT NULL,
  last_name    TEXT NOT NULL,
  affiliation  TEXT,
  email        TEXT NOT NULL,
  phone        TEXT NOT NULL,
  note         TEXT,
  contacted_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS visiting_requests_created_at_idx
  ON visiting_requests (created_at DESC);
