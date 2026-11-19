ALTER TABLE devices
  ADD COLUMN IF NOT EXISTS power_rating VARCHAR(40);

ALTER TABLE field_signals
  ADD COLUMN IF NOT EXISTS device_id UUID REFERENCES devices (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS issues_found JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS error_code VARCHAR(80),
  ADD COLUMN IF NOT EXISTS risk_note VARCHAR(400),
  ADD COLUMN IF NOT EXISTS scope_costs JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE field_signals
  ADD CONSTRAINT field_signals_issues_found_check
    CHECK (jsonb_typeof(issues_found) = 'array'),
  ADD CONSTRAINT field_signals_scope_costs_check
    CHECK (jsonb_typeof(scope_costs) = 'object');

CREATE INDEX IF NOT EXISTS field_signals_device_idx
  ON field_signals (device_id)
  WHERE device_id IS NOT NULL;
