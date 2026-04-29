-- Synthetic "Archive" event used as a container for historical photos
-- imported from the old website. Treated like any other event for upload /
-- review / marquee tagging, but filtered out of the public /photos gallery
-- rows so it doesn't show up as its own dated gathering.
INSERT INTO events (slug, name, date, event_type)
VALUES (
  'archive',
  'Archive (past photos)',
  '2018-01-01',
  'casual'
)
ON CONFLICT (slug) DO NOTHING;
