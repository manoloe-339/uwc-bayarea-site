-- Per-user directory accounts (replaces shared DIRECTORY_PASSWORD as the
-- primary path; shared remains as an emergency-fallback parallel path).
--
-- One row per invited user with their hashed password and a session_version
-- bumped on revoke so live cookies invalidate immediately.
CREATE TABLE IF NOT EXISTS directory_users (
  id              SERIAL PRIMARY KEY,
  alumni_id       INTEGER REFERENCES alumni(id) ON DELETE SET NULL,
  -- Denormalized so revocation lookup works even if the alumni row
  -- changes email later. Always lowercased.
  email           TEXT UNIQUE NOT NULL,
  status          TEXT NOT NULL DEFAULT 'invited',  -- invited | active | revoked
  password_hash   TEXT,                              -- PBKDF2-SHA256 base64url
  password_salt   TEXT,                              -- base64url, per user
  session_version INTEGER NOT NULL DEFAULT 1,        -- bumped on revoke
  invited_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  activated_at    TIMESTAMPTZ,
  last_seen_at    TIMESTAMPTZ,
  revoked_at      TIMESTAMPTZ
);

-- Single-use invite tokens. We never store the plaintext token —
-- only its SHA-256 hash. The plaintext lives in the email link.
CREATE TABLE IF NOT EXISTS directory_invite_tokens (
  token_hash         TEXT PRIMARY KEY,
  directory_user_id  INTEGER NOT NULL REFERENCES directory_users(id) ON DELETE CASCADE,
  expires_at         TIMESTAMPTZ NOT NULL,
  used_at            TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS directory_invite_tokens_user_idx
  ON directory_invite_tokens (directory_user_id, expires_at DESC);

-- Personal shortlist + outreach tracker for directory users. status and
-- reason use small allowlists enforced in app code (no enums to keep
-- additions cheap).
CREATE TABLE IF NOT EXISTS directory_saves (
  id                SERIAL PRIMARY KEY,
  directory_user_id INTEGER NOT NULL REFERENCES directory_users(id) ON DELETE CASCADE,
  alumni_id         INTEGER NOT NULL REFERENCES alumni(id) ON DELETE CASCADE,
  reason            TEXT,
  status            TEXT NOT NULL DEFAULT 'not_contacted',
  note              TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (directory_user_id, alumni_id)
);

CREATE INDEX IF NOT EXISTS directory_saves_user_idx
  ON directory_saves (directory_user_id, updated_at DESC);

-- Attribute audit rows to the per-user account so the admin can drill
-- into individual usage. Shared-password sessions leave this null and
-- get prefixed in session_id ('shared:...') for visual distinction.
ALTER TABLE directory_views
  ADD COLUMN IF NOT EXISTS directory_user_id INTEGER REFERENCES directory_users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS directory_views_user_at_idx
  ON directory_views (directory_user_id, at DESC)
  WHERE directory_user_id IS NOT NULL;
