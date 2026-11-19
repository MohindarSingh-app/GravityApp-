-- Align the customer panel schema with the production AMC, repair, and project model.
-- companies and sites stay the existing core tables. customers is the company member
-- referenced by every AMC, repair, and project row. Login accounts remain users.

CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  company_id UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT customers_user_unique UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS customers_company_idx ON customers (company_id);

DROP TRIGGER IF EXISTS customers_set_updated_at ON customers;
CREATE TRIGGER customers_set_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

INSERT INTO customers (user_id, company_id)
SELECT id, company_id
FROM users
WHERE company_id IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;

-- Common attachment store. Repair and project attachment views sit on this table.
ALTER TABLE customer_attachments RENAME TO attachments;
ALTER TABLE attachments RENAME COLUMN customer_id TO uploaded_by;
ALTER TABLE attachments RENAME COLUMN content_type TO mime_type;
ALTER TABLE attachments RENAME COLUMN storage_key TO file_reference;
ALTER TABLE attachments RENAME CONSTRAINT customer_attachments_company_key_unique TO attachments_company_reference_unique;

-- AMC column names used by the contract, request, and reschedule workflows.
ALTER TABLE amc_contracts RENAME COLUMN amc_type TO contract_type;
ALTER TABLE amc_requests RENAME COLUMN existing_contract_id TO contract_id;
ALTER TABLE amc_requests RENAME COLUMN requested_service TO service_requirement;
ALTER TABLE amc_reschedules RENAME COLUMN old_scheduled_date TO previous_schedule;
ALTER TABLE amc_reschedules RENAME COLUMN requested_new_date TO requested_schedule;
ALTER TABLE devices RENAME COLUMN installation_location TO location;
ALTER TABLE repair_tickets RENAME COLUMN fault_information TO error_details;

COMMENT ON COLUMN amc_contracts.visit_frequency IS 'Visit schedule frequency';
COMMENT ON COLUMN amc_contracts.visits_per_year IS 'Visit schedule count';
COMMENT ON COLUMN amc_contracts.next_visit_date IS 'Visit schedule next date';
COMMENT ON COLUMN amc_contracts.preferred_visit_time IS 'Visit schedule preferred time';

CREATE SEQUENCE IF NOT EXISTS amc_request_number_seq;
CREATE SEQUENCE IF NOT EXISTS project_request_number_seq;

ALTER TABLE amc_requests ADD COLUMN IF NOT EXISTS request_number VARCHAR(32);
ALTER TABLE project_requests ADD COLUMN IF NOT EXISTS request_number VARCHAR(32);

UPDATE amc_requests
SET request_number = 'AMR-' || to_char(created_at AT TIME ZONE 'UTC', 'YYYY') || '-' ||
  lpad(nextval('amc_request_number_seq')::text, 6, '0')
WHERE request_number IS NULL;

UPDATE project_requests
SET request_number = 'PRJ-' || to_char(created_at AT TIME ZONE 'UTC', 'YYYY') || '-' ||
  lpad(nextval('project_request_number_seq')::text, 6, '0')
WHERE request_number IS NULL;

ALTER TABLE amc_requests ALTER COLUMN request_number SET NOT NULL;
ALTER TABLE project_requests ALTER COLUMN request_number SET NOT NULL;
ALTER TABLE amc_requests DROP CONSTRAINT IF EXISTS amc_requests_request_number_unique;
ALTER TABLE amc_requests ADD CONSTRAINT amc_requests_request_number_unique UNIQUE (request_number);
ALTER TABLE project_requests DROP CONSTRAINT IF EXISTS project_requests_request_number_unique;
ALTER TABLE project_requests ADD CONSTRAINT project_requests_request_number_unique UNIQUE (request_number);

-- Point customer_id at customers, not login accounts.
DO $$
DECLARE
  ref record;
BEGIN
  FOR ref IN
    SELECT con.conname, rel.relname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = ANY (con.conkey)
    WHERE con.contype = 'f'
      AND att.attname = 'customer_id'
      AND rel.relname IN (
        'amc_contracts', 'amc_requests', 'amc_reschedules',
        'devices', 'repair_tickets', 'project_requests'
      )
  LOOP
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', ref.relname, ref.conname);
  END LOOP;
END $$;

UPDATE amc_contracts AS row SET customer_id = cust.id FROM customers AS cust WHERE cust.user_id = row.customer_id;
UPDATE amc_requests AS row SET customer_id = cust.id FROM customers AS cust WHERE cust.user_id = row.customer_id;
UPDATE amc_reschedules AS row SET customer_id = cust.id FROM customers AS cust WHERE cust.user_id = row.customer_id;
UPDATE devices AS row SET customer_id = cust.id FROM customers AS cust WHERE cust.user_id = row.customer_id;
UPDATE repair_tickets AS row SET customer_id = cust.id FROM customers AS cust WHERE cust.user_id = row.customer_id;
UPDATE project_requests AS row SET customer_id = cust.id FROM customers AS cust WHERE cust.user_id = row.customer_id;

ALTER TABLE amc_contracts
  ADD CONSTRAINT amc_contracts_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE RESTRICT;
ALTER TABLE amc_requests
  ADD CONSTRAINT amc_requests_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE RESTRICT;
ALTER TABLE amc_reschedules
  ADD CONSTRAINT amc_reschedules_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE RESTRICT;
ALTER TABLE devices
  ADD CONSTRAINT devices_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE RESTRICT;
ALTER TABLE repair_tickets
  ADD CONSTRAINT repair_tickets_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE RESTRICT;
ALTER TABLE project_requests
  ADD CONSTRAINT project_requests_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE RESTRICT;

CREATE TABLE IF NOT EXISTS amc_contract_statuses (
  code VARCHAR(32) PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  sort_order INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS amc_request_statuses (
  code VARCHAR(32) PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  sort_order INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS amc_reschedule_statuses (
  code VARCHAR(32) PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  sort_order INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS repair_statuses (
  code VARCHAR(32) PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  sort_order INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS project_statuses (
  code VARCHAR(32) PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  sort_order INTEGER NOT NULL
);

INSERT INTO amc_contract_statuses (code, name, sort_order) VALUES
  ('active', 'Active', 1),
  ('suspended', 'Suspended', 2),
  ('expired', 'Expired', 3),
  ('cancelled', 'Cancelled', 4)
ON CONFLICT (code) DO NOTHING;

INSERT INTO amc_request_statuses (code, name, sort_order) VALUES
  ('draft', 'Draft', 1),
  ('submitted', 'Submitted', 2),
  ('under_review', 'Under review', 3),
  ('scheduled', 'Scheduled', 4),
  ('reschedule_requested', 'Reschedule requested', 5),
  ('rescheduled', 'Rescheduled', 6),
  ('confirmed', 'Confirmed', 7),
  ('completed', 'Completed', 8),
  ('cancelled', 'Cancelled', 9)
ON CONFLICT (code) DO NOTHING;

INSERT INTO amc_reschedule_statuses (code, name, sort_order) VALUES
  ('pending', 'Pending', 1),
  ('approved', 'Approved', 2),
  ('rejected', 'Rejected', 3),
  ('cancelled', 'Cancelled', 4)
ON CONFLICT (code) DO NOTHING;

INSERT INTO repair_statuses (code, name, sort_order) VALUES
  ('draft', 'Draft', 1),
  ('submitted', 'Submitted', 2),
  ('received', 'Received', 3),
  ('diagnosis', 'Diagnosis', 4),
  ('estimate_required', 'Estimate required', 5),
  ('approved', 'Approved', 6),
  ('repair_in_progress', 'Repair in progress', 7),
  ('ready', 'Ready', 8),
  ('returned', 'Returned', 9),
  ('completed', 'Completed', 10),
  ('cancelled', 'Cancelled', 11)
ON CONFLICT (code) DO NOTHING;

INSERT INTO project_statuses (code, name, sort_order) VALUES
  ('draft', 'Draft', 1),
  ('submitted', 'Submitted', 2),
  ('under_review', 'Under review', 3),
  ('clarification_required', 'Clarification required', 4),
  ('approved', 'Approved', 5),
  ('in_progress', 'In progress', 6),
  ('completed', 'Completed', 7),
  ('cancelled', 'Cancelled', 8)
ON CONFLICT (code) DO NOTHING;

ALTER TABLE amc_contracts DROP CONSTRAINT IF EXISTS amc_contracts_status_check;
ALTER TABLE amc_requests DROP CONSTRAINT IF EXISTS amc_requests_status_check;
ALTER TABLE amc_reschedules DROP CONSTRAINT IF EXISTS amc_reschedules_status_check;
ALTER TABLE repair_tickets DROP CONSTRAINT IF EXISTS repair_tickets_status_check;
ALTER TABLE project_requests DROP CONSTRAINT IF EXISTS project_requests_status_check;

ALTER TABLE amc_contracts
  ADD CONSTRAINT amc_contracts_status_fkey FOREIGN KEY (status) REFERENCES amc_contract_statuses (code);
ALTER TABLE amc_requests
  ADD CONSTRAINT amc_requests_status_fkey FOREIGN KEY (status) REFERENCES amc_request_statuses (code);
ALTER TABLE amc_reschedules
  ADD CONSTRAINT amc_reschedules_status_fkey FOREIGN KEY (status) REFERENCES amc_reschedule_statuses (code);
ALTER TABLE repair_tickets
  ADD CONSTRAINT repair_tickets_status_fkey FOREIGN KEY (status) REFERENCES repair_statuses (code);
ALTER TABLE project_requests
  ADD CONSTRAINT project_requests_status_fkey FOREIGN KEY (status) REFERENCES project_statuses (code);

CREATE TABLE IF NOT EXISTS amc_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  amc_request_id UUID REFERENCES amc_requests (id) ON DELETE CASCADE,
  amc_contract_id UUID REFERENCES amc_contracts (id) ON DELETE CASCADE,
  amc_reschedule_id UUID REFERENCES amc_reschedules (id) ON DELETE CASCADE,
  old_status VARCHAR(32),
  new_status VARCHAR(32) NOT NULL,
  changed_by UUID REFERENCES users (id) ON DELETE SET NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  remarks TEXT,
  CONSTRAINT amc_status_history_one_target_check CHECK (
    (CASE WHEN amc_request_id IS NULL THEN 0 ELSE 1 END
      + CASE WHEN amc_contract_id IS NULL THEN 0 ELSE 1 END
      + CASE WHEN amc_reschedule_id IS NULL THEN 0 ELSE 1 END) = 1
  )
);

CREATE INDEX IF NOT EXISTS amc_status_history_request_idx
  ON amc_status_history (amc_request_id, changed_at);
CREATE INDEX IF NOT EXISTS amc_status_history_contract_idx
  ON amc_status_history (amc_contract_id, changed_at);
CREATE INDEX IF NOT EXISTS amc_status_history_reschedule_idx
  ON amc_status_history (amc_reschedule_id, changed_at);

CREATE TABLE IF NOT EXISTS repair_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repair_ticket_id UUID NOT NULL REFERENCES repair_tickets (id) ON DELETE CASCADE,
  old_status VARCHAR(32),
  new_status VARCHAR(32) NOT NULL,
  changed_by UUID REFERENCES users (id) ON DELETE SET NULL,
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS repair_status_history_ticket_idx
  ON repair_status_history (repair_ticket_id, created_at);

CREATE TABLE IF NOT EXISTS project_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_request_id UUID NOT NULL REFERENCES project_requests (id) ON DELETE CASCADE,
  old_status VARCHAR(32),
  new_status VARCHAR(32) NOT NULL,
  changed_by UUID REFERENCES users (id) ON DELETE SET NULL,
  remarks TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS project_status_history_request_idx
  ON project_status_history (project_request_id, changed_at);

INSERT INTO amc_status_history (
  company_id, amc_request_id, old_status, new_status, changed_by, changed_at, remarks
)
SELECT company_id, entity_id, from_status, to_status, actor_id, created_at, note
FROM customer_status_history
WHERE entity_type = 'amc_request';

INSERT INTO amc_status_history (
  company_id, amc_contract_id, old_status, new_status, changed_by, changed_at, remarks
)
SELECT company_id, entity_id, from_status, to_status, actor_id, created_at, note
FROM customer_status_history
WHERE entity_type = 'amc_contract';

INSERT INTO amc_status_history (
  company_id, amc_reschedule_id, old_status, new_status, changed_by, changed_at, remarks
)
SELECT company_id, entity_id, from_status, to_status, actor_id, created_at, note
FROM customer_status_history
WHERE entity_type = 'amc_reschedule';

INSERT INTO repair_status_history (
  repair_ticket_id, old_status, new_status, changed_by, remarks, created_at
)
SELECT entity_id, from_status, to_status, actor_id, note, created_at
FROM customer_status_history
WHERE entity_type = 'repair_ticket';

INSERT INTO project_status_history (
  project_request_id, old_status, new_status, changed_by, remarks, changed_at
)
SELECT entity_id, from_status, to_status, actor_id, note, created_at
FROM customer_status_history
WHERE entity_type = 'project_request';

DROP TABLE customer_status_history;

CREATE TABLE IF NOT EXISTS project_request_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_request_id UUID NOT NULL REFERENCES project_requests (id) ON DELETE CASCADE,
  field_key VARCHAR(80) NOT NULL,
  field_value TEXT,
  data_type VARCHAR(20) NOT NULL DEFAULT 'text',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT project_request_details_key_unique UNIQUE (project_request_id, field_key),
  CONSTRAINT project_request_details_key_check CHECK (field_key ~ '^[a-z][a-z0-9_]{0,79}$'),
  CONSTRAINT project_request_details_type_check CHECK (data_type IN ('text', 'number', 'date', 'boolean'))
);

CREATE INDEX IF NOT EXISTS project_request_details_request_idx
  ON project_request_details (project_request_id);

DROP TRIGGER IF EXISTS project_request_details_set_updated_at ON project_request_details;
CREATE TRIGGER project_request_details_set_updated_at
  BEFORE UPDATE ON project_request_details
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

INSERT INTO project_categories (code, name, sort_order) VALUES
  ('plant', 'Plant', 4),
  ('panels', 'Panels', 5),
  ('earthing', 'Earthing', 6),
  ('controls_plc', 'Controls/PLC', 7),
  ('vfd', 'VFD', 8),
  ('hmi_scada', 'HMI/SCADA', 9),
  ('servo', 'Servo', 10),
  ('networking', 'Networking', 11),
  ('machine_electrical', 'Machine Electrical', 12),
  ('plant_setup', 'Plant Setup', 13),
  ('relocation', 'Relocation', 14)
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name, active = TRUE;

ALTER TABLE project_requests DROP CONSTRAINT IF EXISTS project_requests_type_category_fkey;

UPDATE project_types AS t
SET category_id = c.id,
    name = v.name
FROM (
  VALUES
    ('mcc_panel', 'panels', 'MCC Panel'),
    ('vfd_panel', 'panels', 'VFD Panel'),
    ('control_panel', 'panels', 'Control Panel'),
    ('distribution_board', 'panels', 'Distribution Board'),
    ('apfc_capacitor_bank', 'panels', 'APFC / Capacitor Bank'),
    ('earthing', 'earthing', 'Earthing System'),
    ('plc', 'controls_plc', 'PLC System'),
    ('vfd_installation', 'vfd', 'VFD Installation'),
    ('hmi_scada', 'hmi_scada', 'HMI / SCADA'),
    ('servo', 'servo', 'Servo System'),
    ('power_cable_layout', 'cabling', 'Power Cable Layout'),
    ('fiber_network', 'networking', 'Fiber Network'),
    ('lan_structured_cabling', 'networking', 'LAN / Structured Cabling'),
    ('machine_electrical_connection', 'machine_electrical', 'Machine Electrical Connection'),
    ('complete_plant_electrical_setup', 'plant_setup', 'Complete Plant Electrical Setup'),
    ('plant_expansion', 'plant', 'Plant Expansion'),
    ('factory_relocation_rewiring', 'relocation', 'Factory Relocation / Rewiring')
) AS v(type_code, category_code, name)
JOIN project_categories c ON c.code = v.category_code
WHERE t.code = v.type_code;

INSERT INTO project_types (category_id, code, name, sort_order)
SELECT c.id, v.code, v.name, v.sort_order
FROM (
  VALUES
    ('electrical', 'electrical_project', 'Electrical Project', 1),
    ('automation', 'automation_project', 'Automation Project', 1),
    ('cabling', 'cable_installation', 'Cable Installation', 1)
) AS v(category_code, code, name, sort_order)
JOIN project_categories c ON c.code = v.category_code
ON CONFLICT (code) DO NOTHING;

UPDATE project_categories c
SET active = FALSE
WHERE NOT EXISTS (
  SELECT 1 FROM project_types t WHERE t.category_id = c.id AND t.active = TRUE
);

UPDATE project_requests AS r
SET category_id = t.category_id
FROM project_types AS t
WHERE t.id = r.project_type_id
  AND r.category_id IS DISTINCT FROM t.category_id;

ALTER TABLE project_requests
  ADD CONSTRAINT project_requests_type_category_fkey
  FOREIGN KEY (project_type_id, category_id)
  REFERENCES project_types (id, category_id);

CREATE OR REPLACE VIEW repair_attachments AS
SELECT
  id,
  entity_id AS repair_ticket_id,
  file_reference,
  file_name,
  mime_type AS file_type,
  uploaded_by,
  created_at
FROM attachments
WHERE entity_type = 'repair_ticket';

CREATE OR REPLACE VIEW project_attachments AS
SELECT
  id,
  entity_id AS project_request_id,
  file_reference,
  file_name,
  mime_type,
  uploaded_by,
  created_at
FROM attachments
WHERE entity_type = 'project_request';

CREATE OR REPLACE VIEW amc_attachments AS
SELECT
  id,
  entity_id AS amc_request_id,
  file_reference,
  file_name,
  mime_type,
  uploaded_by,
  created_at
FROM attachments
WHERE entity_type = 'amc_request';

CREATE INDEX IF NOT EXISTS amc_contracts_site_status_idx ON amc_contracts (company_id, site_id, status);
CREATE INDEX IF NOT EXISTS amc_requests_site_status_idx ON amc_requests (company_id, site_id, status);
CREATE INDEX IF NOT EXISTS devices_company_site_idx ON devices (company_id, site_id);
CREATE INDEX IF NOT EXISTS repair_tickets_status_idx ON repair_tickets (company_id, status);
CREATE INDEX IF NOT EXISTS project_requests_type_idx ON project_requests (company_id, project_type_id, status);
