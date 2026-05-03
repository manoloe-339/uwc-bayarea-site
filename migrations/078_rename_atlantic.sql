-- Rename UWC Atlantic → UWC Atlantic College so the canonical form
-- matches the school's official name. Constants in lib/uwc-colleges,
-- lib/uwc-school-visuals, and lib/event-nl-parser have been updated;
-- this brings the 44 existing alumni rows into line.
UPDATE alumni
SET uwc_college = 'UWC Atlantic College'
WHERE uwc_college = 'UWC Atlantic';
