-- Where Friends-of-UWC heard about us. Optional free text.
-- Only the signup form's "Friend" affiliation collects this today;
-- admin detail page also exposes it for editing.

ALTER TABLE alumni ADD COLUMN IF NOT EXISTS how_heard TEXT;
