-- Customer panel: AMC contracts/requests/reschedules, repair devices/tickets,
-- and project requests. Screen navigation does not insert these rows.
-- Field-dashboard amc_plans are unchanged.

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE SEQUENCE IF NOT EXISTS amc_contract_number_seq;
CREATE SEQUENCE IF NOT EXISTS repair_ticket_number_seq;

CREATE TABLE IF NOT EXISTS customer_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  entity_type VARCHAR(32),
  entity_id UUID,
  file_name VARCHAR(255) NOT NULL,
  content_type VARCHAR(120) NOT NULL,
  storage_key VARCHAR(512) NOT NULL,
  byte_size INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT customer_attachments_entity_type_check CHECK (
    entity_type IS NULL OR entity_type IN ('amc_request', 'repair_ticket', 'project_request')
  ),
  CONSTRAINT customer_attachments_file_name_check CHECK (char_length(btrim(file_name)) >= 1),
  CONSTRAINT customer_attachments_storage_key_check CHECK (char_length(btrim(storage_key)) >= 1),
  CONSTRAINT customer_attachments_byte_size_check CHECK (byte_size IS NULL OR byte_size >= 0),
  CONSTRAINT customer_attachments_company_key_unique UNIQUE (company_id, storage_key)
);

CREATE INDEX IF NOT EXISTS customer_attachments_entity_idx
  ON customer_attachments (entity_type, entity_id);

DROP TRIGGER IF EXISTS customer_attachments_set_updated_at ON customer_attachments;
CREATE TRIGGER customer_attachments_set_updated_at
  BEFORE UPDATE ON customer_attachments
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS customer_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  entity_type VARCHAR(32) NOT NULL,
  entity_id UUID NOT NULL,
  from_status VARCHAR(32),
  to_status VARCHAR(32) NOT NULL,
  actor_id UUID REFERENCES users (id) ON DELETE SET NULL,
  actor_role VARCHAR(32),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT customer_status_history_entity_check CHECK (
    entity_type IN ('amc_request', 'amc_reschedule', 'repair_ticket', 'project_request', 'amc_contract')
  )
);

CREATE INDEX IF NOT EXISTS customer_status_history_entity_idx
  ON customer_status_history (entity_type, entity_id, created_at);

CREATE TABLE IF NOT EXISTS amc_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  company_id UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  site_id UUID NOT NULL REFERENCES sites (id) ON DELETE RESTRICT,
  contract_number VARCHAR(32) NOT NULL,
  amc_type VARCHAR(40) NOT NULL,
  coverage TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  visit_frequency VARCHAR(32) NOT NULL,
  visits_per_year INTEGER,
  next_visit_date DATE,
  preferred_visit_time VARCHAR(5),
  status VARCHAR(24) NOT NULL DEFAULT 'active',
  assigned_engineer_name VARCHAR(120),
  assigned_service_team VARCHAR(120),
  service_contact VARCHAR(160),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT amc_contracts_number_unique UNIQUE (contract_number),
  CONSTRAINT amc_contracts_dates_check CHECK (end_date >= start_date),
  CONSTRAINT amc_contracts_type_check CHECK (
    amc_type IN ('comprehensive', 'non_comprehensive', 'preventive', 'labour', 'breakdown')
  ),
  CONSTRAINT amc_contracts_frequency_check CHECK (
    visit_frequency IN ('monthly', 'quarterly', 'half_yearly', 'yearly', 'custom')
  ),
  CONSTRAINT amc_contracts_status_check CHECK (
    status IN ('active', 'suspended', 'expired', 'cancelled')
  ),
  CONSTRAINT amc_contracts_coverage_check CHECK (char_length(btrim(coverage)) >= 2),
  CONSTRAINT amc_contracts_visits_check CHECK (visits_per_year IS NULL OR visits_per_year > 0)
);

CREATE INDEX IF NOT EXISTS amc_contracts_company_idx
  ON amc_contracts (company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS amc_contracts_site_idx ON amc_contracts (site_id);

DROP TRIGGER IF EXISTS amc_contracts_set_updated_at ON amc_contracts;
CREATE TRIGGER amc_contracts_set_updated_at
  BEFORE UPDATE ON amc_contracts
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS amc_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  company_id UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  site_id UUID NOT NULL REFERENCES sites (id) ON DELETE RESTRICT,
  existing_contract_id UUID REFERENCES amc_contracts (id) ON DELETE RESTRICT,
  request_type VARCHAR(40) NOT NULL,
  requested_service TEXT NOT NULL,
  preferred_date DATE,
  preferred_time VARCHAR(5),
  description TEXT,
  scheduled_date DATE,
  scheduled_time VARCHAR(5),
  status VARCHAR(32) NOT NULL DEFAULT 'draft',
  submitted_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT amc_requests_type_check CHECK (
    request_type IN ('new_amc', 'renewal', 'visit', 'coverage_change')
  ),
  CONSTRAINT amc_requests_status_check CHECK (
    status IN (
      'draft', 'submitted', 'under_review', 'scheduled', 'reschedule_requested',
      'rescheduled', 'confirmed', 'completed', 'cancelled'
    )
  ),
  CONSTRAINT amc_requests_service_check CHECK (char_length(btrim(requested_service)) >= 2),
  CONSTRAINT amc_requests_submitted_check CHECK (
    status IN ('draft', 'cancelled') OR preferred_date IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS amc_requests_company_idx
  ON amc_requests (company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS amc_requests_contract_idx ON amc_requests (existing_contract_id);

DROP TRIGGER IF EXISTS amc_requests_set_updated_at ON amc_requests;
CREATE TRIGGER amc_requests_set_updated_at
  BEFORE UPDATE ON amc_requests
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS amc_reschedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  amc_request_id UUID REFERENCES amc_requests (id) ON DELETE CASCADE,
  amc_contract_id UUID REFERENCES amc_contracts (id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  company_id UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  old_scheduled_date DATE NOT NULL,
  requested_new_date DATE NOT NULL,
  reason TEXT NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'pending',
  previous_request_status VARCHAR(32),
  reviewed_by UUID REFERENCES users (id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT amc_reschedules_ref_check CHECK (
    amc_request_id IS NOT NULL OR amc_contract_id IS NOT NULL
  ),
  CONSTRAINT amc_reschedules_status_check CHECK (
    status IN ('pending', 'approved', 'rejected', 'cancelled')
  ),
  CONSTRAINT amc_reschedules_dates_check CHECK (requested_new_date <> old_scheduled_date),
  CONSTRAINT amc_reschedules_reason_check CHECK (char_length(btrim(reason)) >= 2)
);

CREATE UNIQUE INDEX IF NOT EXISTS amc_reschedules_one_pending_request
  ON amc_reschedules (amc_request_id)
  WHERE status = 'pending' AND amc_request_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS amc_reschedules_one_pending_contract
  ON amc_reschedules (amc_contract_id)
  WHERE status = 'pending' AND amc_request_id IS NULL;

CREATE INDEX IF NOT EXISTS amc_reschedules_company_idx
  ON amc_reschedules (company_id, created_at DESC);

DROP TRIGGER IF EXISTS amc_reschedules_set_updated_at ON amc_reschedules;
CREATE TRIGGER amc_reschedules_set_updated_at
  BEFORE UPDATE ON amc_reschedules
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  company_id UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  site_id UUID NOT NULL REFERENCES sites (id) ON DELETE RESTRICT,
  device_type VARCHAR(32) NOT NULL,
  manufacturer VARCHAR(120) NOT NULL,
  model VARCHAR(120) NOT NULL,
  serial_number VARCHAR(120) NOT NULL,
  asset_number VARCHAR(80),
  installation_location VARCHAR(160) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT devices_type_check CHECK (
    device_type IN ('vfd', 'plc', 'hmi', 'servo', 'mcc', 'panel', 'motor', 'drive', 'sensor', 'other')
  ),
  CONSTRAINT devices_manufacturer_check CHECK (char_length(btrim(manufacturer)) >= 1),
  CONSTRAINT devices_model_check CHECK (char_length(btrim(model)) >= 1),
  CONSTRAINT devices_serial_check CHECK (char_length(btrim(serial_number)) >= 1),
  CONSTRAINT devices_location_check CHECK (char_length(btrim(installation_location)) >= 1),
  CONSTRAINT devices_company_serial_unique UNIQUE (company_id, serial_number)
);

CREATE INDEX IF NOT EXISTS devices_company_idx ON devices (company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS devices_site_idx ON devices (site_id);

DROP TRIGGER IF EXISTS devices_set_updated_at ON devices;
CREATE TRIGGER devices_set_updated_at
  BEFORE UPDATE ON devices
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS repair_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number VARCHAR(32) NOT NULL,
  customer_id UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  company_id UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  site_id UUID NOT NULL REFERENCES sites (id) ON DELETE RESTRICT,
  device_id UUID REFERENCES devices (id) ON DELETE RESTRICT,
  repair_scope VARCHAR(40),
  service_type VARCHAR(40),
  priority VARCHAR(20),
  requested_turnaround VARCHAR(80),
  additional_requirements TEXT,
  issue_description TEXT,
  symptoms TEXT,
  fault_information TEXT,
  status VARCHAR(32) NOT NULL DEFAULT 'draft',
  submitted_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT repair_tickets_number_unique UNIQUE (ticket_number),
  CONSTRAINT repair_tickets_scope_check CHECK (
    repair_scope IS NULL OR repair_scope IN ('on_site', 'workshop', 'pickup_and_return')
  ),
  CONSTRAINT repair_tickets_service_check CHECK (
    service_type IS NULL OR service_type IN (
      'inspection', 'component_repair', 'replacement', 'calibration', 'overhaul', 'other'
    )
  ),
  CONSTRAINT repair_tickets_priority_check CHECK (
    priority IS NULL OR priority IN ('low', 'normal', 'high', 'urgent')
  ),
  CONSTRAINT repair_tickets_status_check CHECK (
    status IN (
      'draft', 'submitted', 'received', 'diagnosis', 'estimate_required', 'approved',
      'repair_in_progress', 'ready', 'returned', 'completed', 'cancelled'
    )
  ),
  CONSTRAINT repair_tickets_submitted_check CHECK (
    status IN ('draft', 'cancelled')
    OR (
      device_id IS NOT NULL
      AND repair_scope IS NOT NULL
      AND service_type IS NOT NULL
      AND priority IS NOT NULL
      AND issue_description IS NOT NULL
      AND char_length(btrim(issue_description)) >= 2
    )
  )
);

CREATE INDEX IF NOT EXISTS repair_tickets_company_idx
  ON repair_tickets (company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS repair_tickets_device_idx ON repair_tickets (device_id);

DROP TRIGGER IF EXISTS repair_tickets_set_updated_at ON repair_tickets;
CREATE TRIGGER repair_tickets_set_updated_at
  BEFORE UPDATE ON repair_tickets
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS project_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(40) NOT NULL,
  name VARCHAR(120) NOT NULL,
  sort_order INTEGER NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT project_categories_code_unique UNIQUE (code),
  CONSTRAINT project_categories_name_check CHECK (char_length(btrim(name)) >= 2)
);

CREATE TABLE IF NOT EXISTS project_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES project_categories (id) ON DELETE RESTRICT,
  code VARCHAR(64) NOT NULL,
  name VARCHAR(160) NOT NULL,
  sort_order INTEGER NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT project_types_code_unique UNIQUE (code),
  CONSTRAINT project_types_id_category_unique UNIQUE (id, category_id),
  CONSTRAINT project_types_name_check CHECK (char_length(btrim(name)) >= 2)
);

CREATE INDEX IF NOT EXISTS project_types_category_idx
  ON project_types (category_id, sort_order);

CREATE TABLE IF NOT EXISTS project_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  company_id UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  site_id UUID NOT NULL REFERENCES sites (id) ON DELETE RESTRICT,
  category_id UUID NOT NULL,
  project_type_id UUID NOT NULL,
  title VARCHAR(160) NOT NULL,
  description TEXT NOT NULL,
  requirements TEXT,
  estimated_scope TEXT,
  preferred_timeline VARCHAR(160),
  budget_amount NUMERIC(14, 2),
  budget_currency CHAR(3),
  status VARCHAR(32) NOT NULL DEFAULT 'draft',
  submitted_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT project_requests_type_category_fkey
    FOREIGN KEY (project_type_id, category_id)
    REFERENCES project_types (id, category_id),
  CONSTRAINT project_requests_status_check CHECK (
    status IN (
      'draft', 'submitted', 'under_review', 'clarification_required',
      'approved', 'in_progress', 'completed', 'cancelled'
    )
  ),
  CONSTRAINT project_requests_title_check CHECK (char_length(btrim(title)) >= 2),
  CONSTRAINT project_requests_description_check CHECK (char_length(btrim(description)) >= 2),
  CONSTRAINT project_requests_budget_check CHECK (
    budget_amount IS NULL OR budget_amount >= 0
  ),
  CONSTRAINT project_requests_currency_check CHECK (
    (budget_amount IS NULL AND budget_currency IS NULL)
    OR (budget_amount IS NOT NULL AND budget_currency IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS project_requests_company_idx
  ON project_requests (company_id, created_at DESC);

DROP TRIGGER IF EXISTS project_categories_set_updated_at ON project_categories;
CREATE TRIGGER project_categories_set_updated_at
  BEFORE UPDATE ON project_categories
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS project_types_set_updated_at ON project_types;
CREATE TRIGGER project_types_set_updated_at
  BEFORE UPDATE ON project_types
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS project_requests_set_updated_at ON project_requests;
CREATE TRIGGER project_requests_set_updated_at
  BEFORE UPDATE ON project_requests
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

INSERT INTO project_categories (code, name, sort_order) VALUES
  ('electrical', 'Electrical', 1),
  ('automation', 'Automation', 2),
  ('cabling', 'Cabling', 3),
  ('plant_expansion', 'Plant Expansion', 4)
ON CONFLICT (code) DO NOTHING;

INSERT INTO project_types (category_id, code, name, sort_order)
SELECT c.id, v.code, v.name, v.sort_order
FROM (
  VALUES
    ('electrical', 'mcc_panel', 'MCC Panel', 1),
    ('electrical', 'vfd_panel', 'VFD Panel', 2),
    ('electrical', 'control_panel', 'Control Panel', 3),
    ('electrical', 'distribution_board', 'Distribution Board', 4),
    ('electrical', 'apfc_capacitor_bank', 'APFC / Capacitor Bank', 5),
    ('electrical', 'earthing', 'Earthing', 6),
    ('electrical', 'machine_electrical_connection', 'Machine Electrical Connection', 7),
    ('electrical', 'complete_plant_electrical_setup', 'Complete Plant Electrical Setup', 8),
    ('automation', 'plc', 'PLC', 1),
    ('automation', 'vfd_installation', 'VFD Installation', 2),
    ('automation', 'hmi_scada', 'HMI / SCADA', 3),
    ('automation', 'servo', 'Servo', 4),
    ('cabling', 'power_cable_layout', 'Power Cable Layout', 1),
    ('cabling', 'fiber_network', 'Fiber Network', 2),
    ('cabling', 'lan_structured_cabling', 'LAN / Structured Cabling', 3),
    ('plant_expansion', 'plant_expansion', 'Plant Expansion', 1),
    ('plant_expansion', 'factory_relocation_rewiring', 'Factory Relocation / Rewiring', 2)
) AS v(category_code, code, name, sort_order)
JOIN project_categories c ON c.code = v.category_code
ON CONFLICT (code) DO NOTHING;
