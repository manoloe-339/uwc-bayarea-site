-- Read-only "directory" surface for trusted volunteers/organizers who
-- need to look up alumni and connect on LinkedIn — without exposing
-- email/phone or any write capability.

-- Audit log of search queries and profile views. Useful to see what
-- the read-only credential is being used for (and spot scraping).
CREATE TABLE IF NOT EXISTS directory_views (
  id          SERIAL PRIMARY KEY,
  session_id  TEXT NOT NULL,        -- hash of directory_session cookie
  action      TEXT NOT NULL,        -- 'search' | 'profile_view'
  target_id   INTEGER REFERENCES alumni(id) ON DELETE SET NULL,
  query_json  JSONB,                -- search filters for action='search'
  at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS directory_views_at_idx
  ON directory_views (at DESC);
CREATE INDEX IF NOT EXISTS directory_views_target_idx
  ON directory_views (target_id, at DESC)
  WHERE target_id IS NOT NULL;

-- Free-form feedback from directory users. Lets them flag bad data
-- ("this LinkedIn URL is dead"), report missing people, or just leave
-- a note for the admin without round-tripping through email.
CREATE TABLE IF NOT EXISTS directory_feedback (
  id            SERIAL PRIMARY KEY,
  session_id    TEXT NOT NULL,
  topic         TEXT NOT NULL,      -- 'general' | 'profile' | 'bug'
  alumni_id     INTEGER REFERENCES alumni(id) ON DELETE SET NULL,
  message       TEXT NOT NULL,
  contact_name  TEXT,               -- optional: who's leaving feedback
  page_url      TEXT,
  status        TEXT NOT NULL DEFAULT 'unread', -- unread | read | dismissed
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS directory_feedback_queue_idx
  ON directory_feedback (created_at DESC)
  WHERE status = 'unread';
