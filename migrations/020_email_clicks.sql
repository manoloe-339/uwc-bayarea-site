-- Per-URL click log. Today we only stamp email_sends.clicked_at (first
-- click timestamp) and lose the URL. This captures every click event
-- with the URL so admin can see WHAT the recipient clicked, not just
-- whether they clicked.

CREATE TABLE IF NOT EXISTS email_clicks (
  id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  send_id    UUID         NOT NULL REFERENCES email_sends(id) ON DELETE CASCADE,
  url        TEXT         NOT NULL,
  clicked_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS email_clicks_send_id_idx
  ON email_clicks (send_id);
CREATE INDEX IF NOT EXISTS email_clicks_clicked_at_idx
  ON email_clicks (clicked_at DESC);
