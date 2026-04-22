-- Event planning: curated invite lists that pull selected alumni into a
-- named bucket for event targeting, follow-up, and emails. Email sends
-- reuse the existing campaign pipeline — we just hand it the list's IDs.

CREATE TABLE IF NOT EXISTS event_invite_lists (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT        NOT NULL,
  description     TEXT,
  event_date      DATE,
  event_location  TEXT,
  original_query  TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS event_invite_lists_created_idx
  ON event_invite_lists (created_at DESC);

CREATE TABLE IF NOT EXISTS event_invite_list_members (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id       UUID        NOT NULL REFERENCES event_invite_lists(id) ON DELETE CASCADE,
  alumni_id     INTEGER     NOT NULL REFERENCES alumni(id) ON DELETE CASCADE,
  added_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  match_score   INTEGER,
  match_reason  TEXT,
  status        TEXT        NOT NULL DEFAULT 'pending',
  UNIQUE(list_id, alumni_id)
);

CREATE INDEX IF NOT EXISTS event_invite_list_members_list_idx
  ON event_invite_list_members (list_id);
CREATE INDEX IF NOT EXISTS event_invite_list_members_alumni_idx
  ON event_invite_list_members (alumni_id);
