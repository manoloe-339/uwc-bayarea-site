-- Per-signal snooze state for the /admin dashboard. Each row hides one
-- signal (identified by a stable string id like "cadence:newsletter"
-- or "event_recap:42") until snoozed_until passes. The dashboard
-- computes signals freshly on every page load and filters anything
-- that's still in the snooze window.
--
-- A signal that resolves naturally (e.g. campaign got sent) just
-- doesn't appear next render — the snooze row becomes harmless dead
-- weight, cleaned up by the COALESCE in the upsert below the next
-- time the signal returns.
CREATE TABLE IF NOT EXISTS dashboard_signal_snoozes (
  signal_id     TEXT PRIMARY KEY,
  snoozed_until TIMESTAMPTZ NOT NULL,
  snoozed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS dashboard_signal_snoozes_until_idx
  ON dashboard_signal_snoozes (snoozed_until);
