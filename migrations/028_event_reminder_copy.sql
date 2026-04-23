-- Editable reminder-email copy per event. When NULL the sender falls
-- back to the hardcoded defaults in lib/attendee-reminder.ts.
-- Placeholders supported in all three fields:
--   {name}      Recipient's name (alumni full name or Stripe customer name)
--   {event}     Event name
--   {date}      Formatted event date
--   {time}      Event time
--   {location}  Event location
--   {amount}    What this attendee paid (formatted with $ and two decimals)

ALTER TABLE events ADD COLUMN IF NOT EXISTS reminder_subject TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS reminder_heading TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS reminder_body TEXT;
