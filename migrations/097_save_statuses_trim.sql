-- Collapse the save-status funnel from six stages to three:
--   invite_sent · connected · follow_up_later
-- Anything in a retired status (not_contacted, replied, met) gets
-- shifted to follow_up_later — the new "shortlisted but not yet
-- reached out" bucket. The column default moves there too so a
-- freshly-clicked ★ lands in a still-valid status.
UPDATE directory_saves
   SET status = 'follow_up_later'
 WHERE status IN ('not_contacted', 'replied', 'met');

ALTER TABLE directory_saves
  ALTER COLUMN status SET DEFAULT 'follow_up_later';
