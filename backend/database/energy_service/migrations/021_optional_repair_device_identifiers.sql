ALTER TABLE devices
  ALTER COLUMN model DROP NOT NULL,
  ALTER COLUMN serial_number DROP NOT NULL;

ALTER TABLE devices
  DROP CONSTRAINT IF EXISTS devices_model_check,
  DROP CONSTRAINT IF EXISTS devices_serial_check;
