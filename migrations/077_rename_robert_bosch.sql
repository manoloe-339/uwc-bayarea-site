-- Rename UWC Robert Bosch → UWC Robert Bosch College so the canonical
-- form matches the school's actual name. Constants in lib/uwc-colleges,
-- lib/uwc-school-visuals, lib/event-nl-parser, and lib/enrichment have
-- already been updated; this brings existing alumni rows into line.
UPDATE alumni
SET uwc_college = 'UWC Robert Bosch College'
WHERE uwc_college = 'UWC Robert Bosch';
