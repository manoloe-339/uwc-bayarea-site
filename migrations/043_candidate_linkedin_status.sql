ALTER TABLE alumni_candidates DROP CONSTRAINT IF EXISTS alumni_candidates_status_check;
ALTER TABLE alumni_candidates ADD CONSTRAINT alumni_candidates_status_check
  CHECK (status IN (
    'new', 'probable_match', 'possible_match',
    'confirmed', 'invited_linkedin', 'already_connected',
    'scraped', 'added', 'rejected'
  ));
