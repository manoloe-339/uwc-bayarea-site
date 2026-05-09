-- Indefinite "ignore this signal" state for the /admin dashboard,
-- complementing dashboard_signal_snoozes which is time-bounded. Each
-- row hides one signal forever (until manually cleared) and stores
-- the admin's reason so future cards of the same kind can surface
-- the prior rationale as context.
--
-- kind matches the signal's `kind` field (e.g. 'foodies_newsletter',
-- 'newsletter', 'small_dinner') so we can look up history per kind
-- without scanning every signal_id.
CREATE TABLE IF NOT EXISTS dashboard_signal_ignores (
  signal_id  TEXT PRIMARY KEY,
  kind       TEXT NOT NULL,
  reason     TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS dashboard_signal_ignores_kind_idx
  ON dashboard_signal_ignores (kind, created_at DESC);
