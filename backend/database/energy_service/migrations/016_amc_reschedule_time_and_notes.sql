ALTER TABLE amc_reschedules
  ADD COLUMN requested_time VARCHAR(5),
  ADD COLUMN notes TEXT;

ALTER TABLE amc_reschedules
  ADD CONSTRAINT amc_reschedules_requested_time_check
  CHECK (requested_time IS NULL OR requested_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
