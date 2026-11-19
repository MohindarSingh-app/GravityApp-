ALTER TABLE users
  ADD COLUMN IF NOT EXISTS secondary_phone VARCHAR(20);

ALTER TABLE users
  ADD CONSTRAINT users_secondary_phone_check
  CHECK (secondary_phone IS NULL OR secondary_phone ~ '^\+[1-9][0-9]{7,14}$');
