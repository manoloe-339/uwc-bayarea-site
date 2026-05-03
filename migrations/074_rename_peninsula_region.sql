-- Rename the Foodies region from "Peninsula" to "Peninsula / South Bay"
-- so it covers both the SF–Palo Alto stretch and San Jose. Constant in
-- lib/foodies-shared.ts already points at the new label; this brings
-- existing event rows in line so the dropdown still selects the right
-- option on edit.
UPDATE events
SET foodies_region = 'Peninsula / South Bay'
WHERE foodies_region = 'Peninsula';
