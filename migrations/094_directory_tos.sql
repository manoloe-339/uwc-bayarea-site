-- Record the moment a directory user agrees to the directory rules
-- during password setup. Used as an audit trail (so we can prove a
-- given user accepted the rules at a specific timestamp) and as a
-- guard — anyone with no acceptance row has either bypassed setup
-- somehow or was provisioned by an admin path that pre-dated the
-- requirement.
ALTER TABLE directory_users
  ADD COLUMN IF NOT EXISTS tos_accepted_at TIMESTAMPTZ;
