-- Quick service booking. Categories, steps, options, and form fields are the source of truth.
-- The customer app renders this configuration. It does not keep its own service list.

CREATE TABLE IF NOT EXISTS service_request_statuses (
  code VARCHAR(32) PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  sort_order INTEGER NOT NULL
);

INSERT INTO service_request_statuses (code, name, sort_order) VALUES
  ('draft', 'Draft', 10),
  ('submitted', 'Submitted', 20),
  ('searching', 'Finding a specialist', 30),
  ('assigned', 'Specialist assigned', 40),
  ('scheduled', 'Scheduled', 50),
  ('in_progress', 'In progress', 60),
  ('completed', 'Completed', 70),
  ('cancelled', 'Cancelled', 80),
  ('failed', 'Could not assign', 90);

CREATE TABLE IF NOT EXISTS service_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(64) NOT NULL,
  name VARCHAR(120) NOT NULL,
  summary TEXT,
  icon_key VARCHAR(40),
  sort_order INTEGER NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT service_categories_code_unique UNIQUE (code),
  CONSTRAINT service_categories_status_check CHECK (status IN ('active', 'inactive'))
);

CREATE TABLE IF NOT EXISTS service_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES service_categories (id) ON DELETE CASCADE,
  parent_option_id UUID,
  follows_step_id UUID REFERENCES service_steps (id) ON DELETE CASCADE,
  code VARCHAR(64) NOT NULL,
  title VARCHAR(160) NOT NULL,
  summary TEXT,
  step_kind VARCHAR(16) NOT NULL,
  sort_order INTEGER NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT service_steps_code_unique UNIQUE (category_id, code),
  CONSTRAINT service_steps_kind_check CHECK (step_kind IN ('choice', 'form')),
  CONSTRAINT service_steps_status_check CHECK (status IN ('active', 'inactive')),
  CONSTRAINT service_steps_link_check CHECK (parent_option_id IS NULL OR follows_step_id IS NULL)
);

CREATE TABLE IF NOT EXISTS service_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  step_id UUID NOT NULL REFERENCES service_steps (id) ON DELETE CASCADE,
  code VARCHAR(64) NOT NULL,
  name VARCHAR(160) NOT NULL,
  summary TEXT,
  icon_key VARCHAR(40),
  sort_order INTEGER NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'active',
  next_action VARCHAR(40),
  next_action_label VARCHAR(80),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT service_options_code_unique UNIQUE (step_id, code),
  CONSTRAINT service_options_status_check CHECK (status IN ('active', 'inactive'))
);

ALTER TABLE service_steps
  ADD CONSTRAINT service_steps_parent_option_fkey
  FOREIGN KEY (parent_option_id) REFERENCES service_options (id) ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS service_form_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  step_id UUID NOT NULL REFERENCES service_steps (id) ON DELETE CASCADE,
  field_key VARCHAR(64) NOT NULL,
  label VARCHAR(160) NOT NULL,
  field_type VARCHAR(24) NOT NULL,
  required BOOLEAN NOT NULL DEFAULT FALSE,
  placeholder VARCHAR(200),
  help_text TEXT,
  sort_order INTEGER NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT service_form_fields_key_unique UNIQUE (step_id, field_key),
  CONSTRAINT service_form_fields_type_check CHECK (field_type IN ('text', 'textarea', 'select', 'multiselect', 'number')),
  CONSTRAINT service_form_fields_status_check CHECK (status IN ('active', 'inactive'))
);

CREATE TABLE IF NOT EXISTS service_field_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_id UUID NOT NULL REFERENCES service_form_fields (id) ON DELETE CASCADE,
  value VARCHAR(80) NOT NULL,
  label VARCHAR(160) NOT NULL,
  summary TEXT,
  sort_order INTEGER NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'active',
  CONSTRAINT service_field_options_value_unique UNIQUE (field_id, value),
  CONSTRAINT service_field_options_status_check CHECK (status IN ('active', 'inactive'))
);

CREATE SEQUENCE IF NOT EXISTS service_request_number_seq;

CREATE TABLE IF NOT EXISTS service_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers (id) ON DELETE RESTRICT,
  company_id UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  site_id UUID NOT NULL REFERENCES sites (id) ON DELETE RESTRICT,
  category_id UUID NOT NULL REFERENCES service_categories (id) ON DELETE RESTRICT,
  request_number VARCHAR(32) NOT NULL,
  status VARCHAR(32) NOT NULL REFERENCES service_request_statuses (code),
  priority VARCHAR(40),
  preferred_date DATE,
  preferred_time VARCHAR(5),
  assigned_engineer_name VARCHAR(120),
  assigned_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT service_requests_number_unique UNIQUE (request_number),
  CONSTRAINT service_requests_time_check CHECK (
    preferred_time IS NULL OR preferred_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
  )
);

CREATE INDEX IF NOT EXISTS service_requests_company_idx ON service_requests (company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS service_requests_customer_idx ON service_requests (customer_id);
CREATE INDEX IF NOT EXISTS service_steps_category_idx ON service_steps (category_id, sort_order);
CREATE INDEX IF NOT EXISTS service_options_step_idx ON service_options (step_id, sort_order);

DROP TRIGGER IF EXISTS service_requests_set_updated_at ON service_requests;
CREATE TRIGGER service_requests_set_updated_at
  BEFORE UPDATE ON service_requests
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS service_request_selections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES service_requests (id) ON DELETE CASCADE,
  step_id UUID NOT NULL REFERENCES service_steps (id) ON DELETE RESTRICT,
  option_id UUID NOT NULL REFERENCES service_options (id) ON DELETE RESTRICT,
  sort_order INTEGER NOT NULL,
  CONSTRAINT service_request_selections_unique UNIQUE (request_id, step_id)
);

CREATE TABLE IF NOT EXISTS service_request_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES service_requests (id) ON DELETE CASCADE,
  field_id UUID NOT NULL REFERENCES service_form_fields (id) ON DELETE RESTRICT,
  value_text TEXT NOT NULL,
  CONSTRAINT service_request_answers_unique UNIQUE (request_id, field_id)
);

CREATE TABLE IF NOT EXISTS service_request_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_request_id UUID NOT NULL REFERENCES service_requests (id) ON DELETE CASCADE,
  old_status VARCHAR(32),
  new_status VARCHAR(32) NOT NULL,
  changed_by UUID REFERENCES users (id) ON DELETE SET NULL,
  remarks TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS service_request_status_history_idx
  ON service_request_status_history (service_request_id, changed_at);

ALTER TABLE attachments DROP CONSTRAINT IF EXISTS customer_attachments_entity_type_check;
ALTER TABLE attachments DROP CONSTRAINT IF EXISTS attachments_entity_type_check;
ALTER TABLE attachments ADD CONSTRAINT attachments_entity_type_check CHECK (
  entity_type IS NULL OR entity_type IN ('amc_request', 'repair_ticket', 'project_request', 'service_request')
);


INSERT INTO service_categories (code, name, summary, icon_key, sort_order, status)
VALUES ('electrician', 'Electrician', 'Wiring, panel fault, and earthing', 'bolt', 1, 'active');
INSERT INTO service_steps (category_id, code, title, summary, step_kind, sort_order, status)
SELECT id, 'work_type', 'Service type', 'Select the type of electrical work. A certified electrician will be matched for the site.', 'choice', 1, 'active'
FROM service_categories
WHERE code = 'electrician';
INSERT INTO service_options (step_id, code, name, summary, sort_order, status, next_action, next_action_label)
SELECT s.id, 'general_wiring', 'General Wiring & Repair', 'Fan, light, socket, switch fault', 1, 'active', NULL, NULL
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'electrician' AND s.code = 'work_type';
INSERT INTO service_options (step_id, code, name, summary, sort_order, status, next_action, next_action_label)
SELECT s.id, 'ht_lt_panel', 'HT / LT Panel Work', 'Panel fault, upgrade, installation', 2, 'active', NULL, NULL
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'electrician' AND s.code = 'work_type';
INSERT INTO service_options (step_id, code, name, summary, sort_order, status, next_action, next_action_label)
SELECT s.id, 'mcb_fault', 'MCB / MCCB / RCCB Fault', 'Tripping, replacement, testing', 3, 'active', NULL, NULL
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'electrician' AND s.code = 'work_type';
INSERT INTO service_options (step_id, code, name, summary, sort_order, status, next_action, next_action_label)
SELECT s.id, 'earthing', 'Earthing & Lightning Protection', 'Earth pit, testing, lightning arrester', 4, 'active', NULL, NULL
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'electrician' AND s.code = 'work_type';
INSERT INTO service_options (step_id, code, name, summary, sort_order, status, next_action, next_action_label)
SELECT s.id, 'cable_laying', 'Cable Laying & Termination', 'New cable, re-routing, termination', 5, 'active', NULL, NULL
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'electrician' AND s.code = 'work_type';
INSERT INTO service_options (step_id, code, name, summary, sort_order, status, next_action, next_action_label)
SELECT s.id, 'transformer', 'Transformer Maintenance', 'Oil testing, winding check, repair', 6, 'active', NULL, NULL
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'electrician' AND s.code = 'work_type';
INSERT INTO service_options (step_id, code, name, summary, sort_order, status, next_action, next_action_label)
SELECT s.id, 'energy_meter', 'Energy Meter / Billing Issue', 'Meter check, CT/PT, APFC', 7, 'active', NULL, NULL
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'electrician' AND s.code = 'work_type';
INSERT INTO service_steps (category_id, follows_step_id, code, title, summary, step_kind, sort_order, status)
SELECT c.id, prev.id, 'problem', 'Problem details', 'Describe the fault so the electrician can prepare before the visit.', 'form', 2, 'active'
FROM service_categories c
JOIN service_steps prev ON prev.category_id = c.id AND prev.code = 'work_type'
WHERE c.code = 'electrician';
INSERT INTO service_form_fields (
  step_id, field_key, label, field_type, required, placeholder, help_text, sort_order, status
)
SELECT s.id, 'description', 'Problem description', 'textarea', TRUE, 'What is not working?', NULL, 1, 'active'
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'electrician' AND s.code = 'problem';
INSERT INTO service_form_fields (
  step_id, field_key, label, field_type, required, placeholder, help_text, sort_order, status
)
SELECT s.id, 'symptoms', 'Symptoms', 'multiselect', FALSE, NULL, NULL, 2, 'active'
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'electrician' AND s.code = 'problem';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'machine_stopped', 'Machine stopped', NULL, 1, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'electrician' AND s.code = 'problem' AND f.field_key = 'symptoms';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'tripping', 'Tripping', NULL, 2, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'electrician' AND s.code = 'problem' AND f.field_key = 'symptoms';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'sparking', 'Sparking', NULL, 3, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'electrician' AND s.code = 'problem' AND f.field_key = 'symptoms';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'burning_smell', 'Burning smell', NULL, 4, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'electrician' AND s.code = 'problem' AND f.field_key = 'symptoms';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'noise_vibration', 'Noise / vibration', NULL, 5, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'electrician' AND s.code = 'problem' AND f.field_key = 'symptoms';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'overheating', 'Overheating', NULL, 6, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'electrician' AND s.code = 'problem' AND f.field_key = 'symptoms';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'intermittent_fault', 'Intermittent fault', NULL, 7, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'electrician' AND s.code = 'problem' AND f.field_key = 'symptoms';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'new_installation', 'New installation', NULL, 8, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'electrician' AND s.code = 'problem' AND f.field_key = 'symptoms';
INSERT INTO service_form_fields (
  step_id, field_key, label, field_type, required, placeholder, help_text, sort_order, status
)
SELECT s.id, 'urgency', 'Urgency', 'select', TRUE, NULL, NULL, 3, 'active'
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'electrician' AND s.code = 'problem';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'planned', 'Planned', 'Schedule it', 1, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'electrician' AND s.code = 'problem' AND f.field_key = 'urgency';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'urgent', 'Urgent', 'Need today', 2, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'electrician' AND s.code = 'problem' AND f.field_key = 'urgency';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'emergency', 'Emergency', 'Production down', 3, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'electrician' AND s.code = 'problem' AND f.field_key = 'urgency';
INSERT INTO service_form_fields (
  step_id, field_key, label, field_type, required, placeholder, help_text, sort_order, status
)
SELECT s.id, 'notes', 'Additional notes', 'textarea', FALSE, 'Anything else the specialist should know', NULL, 4, 'active'
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'electrician' AND s.code = 'problem';

INSERT INTO service_categories (code, name, summary, icon_key, sort_order, status)
VALUES ('panel_mcc', 'Panel / MCC', 'Panel fault, wiring, and busbar', 'box', 2, 'active');
INSERT INTO service_steps (category_id, code, title, summary, step_kind, sort_order, status)
SELECT id, 'panel_type', 'Service type', 'Select the panel type. A certified engineer will be matched for that panel.', 'choice', 1, 'active'
FROM service_categories
WHERE code = 'panel_mcc';
INSERT INTO service_options (step_id, code, name, summary, sort_order, status, next_action, next_action_label)
SELECT s.id, 'mcc', 'MCC - Motor Control Centre', 'Motor feeder fault, contactor, overload relay', 1, 'active', NULL, NULL
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'panel_mcc' AND s.code = 'panel_type';
INSERT INTO service_options (step_id, code, name, summary, sort_order, status, next_action, next_action_label)
SELECT s.id, 'vfd_panel', 'VFD Panel / Control Panel', 'Panel wiring, control circuit fault', 2, 'active', NULL, NULL
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'panel_mcc' AND s.code = 'panel_type';
INSERT INTO service_options (step_id, code, name, summary, sort_order, status, next_action, next_action_label)
SELECT s.id, 'busbar', 'Busbar / ACB / VCB', 'Air or vacuum circuit breaker, busbar fault', 3, 'active', NULL, NULL
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'panel_mcc' AND s.code = 'panel_type';
INSERT INTO service_options (step_id, code, name, summary, sort_order, status, next_action, next_action_label)
SELECT s.id, 'capacitor', 'Capacitor Bank / APFC', 'Power factor correction, capacitor fault', 4, 'active', NULL, NULL
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'panel_mcc' AND s.code = 'panel_type';
INSERT INTO service_options (step_id, code, name, summary, sort_order, status, next_action, next_action_label)
SELECT s.id, 'control_wiring', 'Control Panel Wiring', 'New build, rewiring, modification', 5, 'active', NULL, NULL
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'panel_mcc' AND s.code = 'panel_type';
INSERT INTO service_steps (category_id, parent_option_id, code, title, summary, step_kind, sort_order, status)
SELECT c.id, opt.id, 'vfd_panel_make', 'Panel make', 'Which make is the VFD panel?', 'choice', 2, 'active'
FROM service_categories c
JOIN service_steps parent_step ON parent_step.category_id = c.id AND parent_step.code = 'panel_type'
JOIN service_options opt ON opt.step_id = parent_step.id AND opt.code = 'vfd_panel'
WHERE c.code = 'panel_mcc';
INSERT INTO service_options (step_id, code, name, summary, sort_order, status, next_action, next_action_label)
SELECT s.id, 'abb', 'ABB', NULL, 1, 'active', NULL, NULL
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'panel_mcc' AND s.code = 'vfd_panel_make';
INSERT INTO service_options (step_id, code, name, summary, sort_order, status, next_action, next_action_label)
SELECT s.id, 'siemens', 'Siemens', NULL, 2, 'active', NULL, NULL
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'panel_mcc' AND s.code = 'vfd_panel_make';
INSERT INTO service_options (step_id, code, name, summary, sort_order, status, next_action, next_action_label)
SELECT s.id, 'schneider', 'Schneider Electric', NULL, 3, 'active', NULL, NULL
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'panel_mcc' AND s.code = 'vfd_panel_make';
INSERT INTO service_options (step_id, code, name, summary, sort_order, status, next_action, next_action_label)
SELECT s.id, 'danfoss', 'Danfoss', NULL, 4, 'active', NULL, NULL
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'panel_mcc' AND s.code = 'vfd_panel_make';
INSERT INTO service_options (step_id, code, name, summary, sort_order, status, next_action, next_action_label)
SELECT s.id, 'yaskawa', 'Yaskawa', NULL, 5, 'active', NULL, NULL
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'panel_mcc' AND s.code = 'vfd_panel_make';
INSERT INTO service_options (step_id, code, name, summary, sort_order, status, next_action, next_action_label)
SELECT s.id, 'mitsubishi', 'Mitsubishi', NULL, 6, 'active', NULL, NULL
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'panel_mcc' AND s.code = 'vfd_panel_make';
INSERT INTO service_options (step_id, code, name, summary, sort_order, status, next_action, next_action_label)
SELECT s.id, 'parker', 'Parker', NULL, 7, 'active', NULL, NULL
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'panel_mcc' AND s.code = 'vfd_panel_make';
INSERT INTO service_options (step_id, code, name, summary, sort_order, status, next_action, next_action_label)
SELECT s.id, 'rockwell', 'Rockwell', NULL, 8, 'active', NULL, NULL
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'panel_mcc' AND s.code = 'vfd_panel_make';
INSERT INTO service_options (step_id, code, name, summary, sort_order, status, next_action, next_action_label)
SELECT s.id, 'other', 'Other', 'Brand is not in this list', 9, 'active', NULL, NULL
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'panel_mcc' AND s.code = 'vfd_panel_make';
INSERT INTO service_steps (category_id, parent_option_id, code, title, summary, step_kind, sort_order, status)
SELECT c.id, opt.id, 'vfd_panel_other', 'Specify panel make', 'Enter the manufacturer when it is not in the list.', 'form', 3, 'active'
FROM service_categories c
JOIN service_steps parent_step ON parent_step.category_id = c.id AND parent_step.code = 'vfd_panel_make'
JOIN service_options opt ON opt.step_id = parent_step.id AND opt.code = 'other'
WHERE c.code = 'panel_mcc';
INSERT INTO service_form_fields (
  step_id, field_key, label, field_type, required, placeholder, help_text, sort_order, status
)
SELECT s.id, 'specify_make', 'Specify make', 'text', TRUE, 'Manufacturer name', NULL, 1, 'active'
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'panel_mcc' AND s.code = 'vfd_panel_other';
INSERT INTO service_steps (category_id, parent_option_id, code, title, summary, step_kind, sort_order, status)
SELECT c.id, opt.id, 'mcc_details', 'Problem details', 'MCC fault details.', 'form', 4, 'active'
FROM service_categories c
JOIN service_steps parent_step ON parent_step.category_id = c.id AND parent_step.code = 'panel_type'
JOIN service_options opt ON opt.step_id = parent_step.id AND opt.code = 'mcc'
WHERE c.code = 'panel_mcc';
INSERT INTO service_form_fields (
  step_id, field_key, label, field_type, required, placeholder, help_text, sort_order, status
)
SELECT s.id, 'symptoms', 'Symptoms', 'multiselect', FALSE, NULL, NULL, 1, 'active'
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'panel_mcc' AND s.code = 'mcc_details';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'single_feeder_tripping', 'Single feeder tripping', NULL, 1, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'panel_mcc' AND s.code = 'mcc_details' AND f.field_key = 'symptoms';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'multiple_feeders_affected', 'Multiple feeders affected', NULL, 2, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'panel_mcc' AND s.code = 'mcc_details' AND f.field_key = 'symptoms';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'overload_relay_fault', 'Overload relay fault', NULL, 3, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'panel_mcc' AND s.code = 'mcc_details' AND f.field_key = 'symptoms';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'contactor_not_pulling_in', 'Contactor not pulling in', NULL, 4, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'panel_mcc' AND s.code = 'mcc_details' AND f.field_key = 'symptoms';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'busbar_overheating', 'Busbar overheating', NULL, 5, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'panel_mcc' AND s.code = 'mcc_details' AND f.field_key = 'symptoms';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'panel_indicator_fault', 'Panel indicator fault', NULL, 6, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'panel_mcc' AND s.code = 'mcc_details' AND f.field_key = 'symptoms';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'entire_panel_tripped_dead', 'Entire panel tripped / dead', NULL, 7, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'panel_mcc' AND s.code = 'mcc_details' AND f.field_key = 'symptoms';
INSERT INTO service_form_fields (
  step_id, field_key, label, field_type, required, placeholder, help_text, sort_order, status
)
SELECT s.id, 'description', 'Problem description', 'textarea', TRUE, NULL, NULL, 2, 'active'
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'panel_mcc' AND s.code = 'mcc_details';
INSERT INTO service_form_fields (
  step_id, field_key, label, field_type, required, placeholder, help_text, sort_order, status
)
SELECT s.id, 'urgency', 'Urgency', 'select', TRUE, NULL, NULL, 3, 'active'
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'panel_mcc' AND s.code = 'mcc_details';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'planned', 'Planned', 'Schedule it', 1, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'panel_mcc' AND s.code = 'mcc_details' AND f.field_key = 'urgency';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'urgent', 'Urgent', 'Need today', 2, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'panel_mcc' AND s.code = 'mcc_details' AND f.field_key = 'urgency';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'emergency', 'Emergency', 'Production down', 3, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'panel_mcc' AND s.code = 'mcc_details' AND f.field_key = 'urgency';
INSERT INTO service_form_fields (
  step_id, field_key, label, field_type, required, placeholder, help_text, sort_order, status
)
SELECT s.id, 'notes', 'Additional notes', 'textarea', FALSE, 'Anything else the specialist should know', NULL, 4, 'active'
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'panel_mcc' AND s.code = 'mcc_details';
INSERT INTO service_steps (category_id, follows_step_id, code, title, summary, step_kind, sort_order, status)
SELECT c.id, prev.id, 'vfd_panel_details', 'Problem details', 'VFD panel fault details.', 'form', 5, 'active'
FROM service_categories c
JOIN service_steps prev ON prev.category_id = c.id AND prev.code = 'vfd_panel_make'
WHERE c.code = 'panel_mcc';
INSERT INTO service_form_fields (
  step_id, field_key, label, field_type, required, placeholder, help_text, sort_order, status
)
SELECT s.id, 'symptoms', 'Symptoms', 'multiselect', FALSE, NULL, NULL, 1, 'active'
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'panel_mcc' AND s.code = 'vfd_panel_details';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'start_stop_not_working_from_panel', 'Start / stop not working from panel', NULL, 1, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'panel_mcc' AND s.code = 'vfd_panel_details' AND f.field_key = 'symptoms';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'control_wiring_loose_broken', 'Control wiring loose / broken', NULL, 2, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'panel_mcc' AND s.code = 'vfd_panel_details' AND f.field_key = 'symptoms';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'panel_overheating', 'Panel overheating', NULL, 3, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'panel_mcc' AND s.code = 'vfd_panel_details' AND f.field_key = 'symptoms';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'cooling_fan_failed', 'Cooling fan failed', NULL, 4, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'panel_mcc' AND s.code = 'vfd_panel_details' AND f.field_key = 'symptoms';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'indicator_ammeter_not_working', 'Indicator / ammeter not working', NULL, 5, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'panel_mcc' AND s.code = 'vfd_panel_details' AND f.field_key = 'symptoms';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'bypass_switch_fault', 'Bypass switch fault', NULL, 6, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'panel_mcc' AND s.code = 'vfd_panel_details' AND f.field_key = 'symptoms';
INSERT INTO service_form_fields (
  step_id, field_key, label, field_type, required, placeholder, help_text, sort_order, status
)
SELECT s.id, 'description', 'Problem description', 'textarea', TRUE, NULL, NULL, 2, 'active'
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'panel_mcc' AND s.code = 'vfd_panel_details';
INSERT INTO service_form_fields (
  step_id, field_key, label, field_type, required, placeholder, help_text, sort_order, status
)
SELECT s.id, 'urgency', 'Urgency', 'select', TRUE, NULL, NULL, 3, 'active'
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'panel_mcc' AND s.code = 'vfd_panel_details';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'planned', 'Planned', 'Schedule it', 1, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'panel_mcc' AND s.code = 'vfd_panel_details' AND f.field_key = 'urgency';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'urgent', 'Urgent', 'Need today', 2, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'panel_mcc' AND s.code = 'vfd_panel_details' AND f.field_key = 'urgency';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'emergency', 'Emergency', 'Production down', 3, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'panel_mcc' AND s.code = 'vfd_panel_details' AND f.field_key = 'urgency';
INSERT INTO service_form_fields (
  step_id, field_key, label, field_type, required, placeholder, help_text, sort_order, status
)
SELECT s.id, 'notes', 'Additional notes', 'textarea', FALSE, 'Anything else the specialist should know', NULL, 4, 'active'
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'panel_mcc' AND s.code = 'vfd_panel_details';
INSERT INTO service_steps (category_id, parent_option_id, code, title, summary, step_kind, sort_order, status)
SELECT c.id, opt.id, 'busbar_details', 'Problem details', 'Busbar, ACB, or VCB details.', 'form', 6, 'active'
FROM service_categories c
JOIN service_steps parent_step ON parent_step.category_id = c.id AND parent_step.code = 'panel_type'
JOIN service_options opt ON opt.step_id = parent_step.id AND opt.code = 'busbar'
WHERE c.code = 'panel_mcc';
INSERT INTO service_form_fields (
  step_id, field_key, label, field_type, required, placeholder, help_text, sort_order, status
)
SELECT s.id, 'symptoms', 'Symptoms', 'multiselect', FALSE, NULL, NULL, 1, 'active'
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'panel_mcc' AND s.code = 'busbar_details';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'acb_vcb_not_closing', 'ACB / VCB not closing', NULL, 1, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'panel_mcc' AND s.code = 'busbar_details' AND f.field_key = 'symptoms';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'breaker_tripping_unexpectedly', 'Breaker tripping unexpectedly', NULL, 2, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'panel_mcc' AND s.code = 'busbar_details' AND f.field_key = 'symptoms';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'busbar_overheating_hotspot', 'Busbar overheating / hotspot', NULL, 3, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'panel_mcc' AND s.code = 'busbar_details' AND f.field_key = 'symptoms';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'busbar_joint_loose_arcing', 'Busbar joint loose / arcing', NULL, 4, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'panel_mcc' AND s.code = 'busbar_details' AND f.field_key = 'symptoms';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'control_mechanism_fault', 'Control mechanism fault', NULL, 5, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'panel_mcc' AND s.code = 'busbar_details' AND f.field_key = 'symptoms';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'annual_maintenance_needed', 'Annual maintenance needed', NULL, 6, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'panel_mcc' AND s.code = 'busbar_details' AND f.field_key = 'symptoms';
INSERT INTO service_form_fields (
  step_id, field_key, label, field_type, required, placeholder, help_text, sort_order, status
)
SELECT s.id, 'description', 'Problem description', 'textarea', TRUE, NULL, NULL, 2, 'active'
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'panel_mcc' AND s.code = 'busbar_details';
INSERT INTO service_form_fields (
  step_id, field_key, label, field_type, required, placeholder, help_text, sort_order, status
)
SELECT s.id, 'urgency', 'Urgency', 'select', TRUE, NULL, NULL, 3, 'active'
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'panel_mcc' AND s.code = 'busbar_details';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'planned', 'Planned', 'Schedule it', 1, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'panel_mcc' AND s.code = 'busbar_details' AND f.field_key = 'urgency';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'urgent', 'Urgent', 'Need today', 2, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'panel_mcc' AND s.code = 'busbar_details' AND f.field_key = 'urgency';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'emergency', 'Emergency', 'Production down', 3, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'panel_mcc' AND s.code = 'busbar_details' AND f.field_key = 'urgency';
INSERT INTO service_form_fields (
  step_id, field_key, label, field_type, required, placeholder, help_text, sort_order, status
)
SELECT s.id, 'notes', 'Additional notes', 'textarea', FALSE, 'Anything else the specialist should know', NULL, 4, 'active'
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'panel_mcc' AND s.code = 'busbar_details';
INSERT INTO service_steps (category_id, parent_option_id, code, title, summary, step_kind, sort_order, status)
SELECT c.id, opt.id, 'capacitor_details', 'Problem details', 'APFC and capacitor bank details.', 'form', 7, 'active'
FROM service_categories c
JOIN service_steps parent_step ON parent_step.category_id = c.id AND parent_step.code = 'panel_type'
JOIN service_options opt ON opt.step_id = parent_step.id AND opt.code = 'capacitor'
WHERE c.code = 'panel_mcc';
INSERT INTO service_form_fields (
  step_id, field_key, label, field_type, required, placeholder, help_text, sort_order, status
)
SELECT s.id, 'symptoms', 'Symptoms', 'multiselect', FALSE, NULL, NULL, 1, 'active'
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'panel_mcc' AND s.code = 'capacitor_details';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'power_factor_penalty_on_bill', 'Power factor penalty on bill', NULL, 1, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'panel_mcc' AND s.code = 'capacitor_details' AND f.field_key = 'symptoms';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'apfc_controller_not_switching', 'APFC controller not switching', NULL, 2, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'panel_mcc' AND s.code = 'capacitor_details' AND f.field_key = 'symptoms';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'capacitor_blown_burst', 'Capacitor blown / burst', NULL, 3, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'panel_mcc' AND s.code = 'capacitor_details' AND f.field_key = 'symptoms';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'thyristor_contactor_fault', 'Thyristor / contactor fault', NULL, 4, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'panel_mcc' AND s.code = 'capacitor_details' AND f.field_key = 'symptoms';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'overheating_harmonics', 'Overheating / harmonics', NULL, 5, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'panel_mcc' AND s.code = 'capacitor_details' AND f.field_key = 'symptoms';
INSERT INTO service_form_fields (
  step_id, field_key, label, field_type, required, placeholder, help_text, sort_order, status
)
SELECT s.id, 'power_factor', 'Current power factor', 'text', FALSE, 'From the electricity bill', 'From the bill, if you have it.', 2, 'active'
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'panel_mcc' AND s.code = 'capacitor_details';
INSERT INTO service_form_fields (
  step_id, field_key, label, field_type, required, placeholder, help_text, sort_order, status
)
SELECT s.id, 'description', 'Problem description', 'textarea', TRUE, NULL, NULL, 3, 'active'
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'panel_mcc' AND s.code = 'capacitor_details';
INSERT INTO service_form_fields (
  step_id, field_key, label, field_type, required, placeholder, help_text, sort_order, status
)
SELECT s.id, 'urgency', 'Urgency', 'select', TRUE, NULL, NULL, 4, 'active'
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'panel_mcc' AND s.code = 'capacitor_details';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'planned', 'Planned', 'Schedule it', 1, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'panel_mcc' AND s.code = 'capacitor_details' AND f.field_key = 'urgency';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'urgent', 'Urgent', 'Need today', 2, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'panel_mcc' AND s.code = 'capacitor_details' AND f.field_key = 'urgency';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'emergency', 'Emergency', 'Production down', 3, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'panel_mcc' AND s.code = 'capacitor_details' AND f.field_key = 'urgency';
INSERT INTO service_form_fields (
  step_id, field_key, label, field_type, required, placeholder, help_text, sort_order, status
)
SELECT s.id, 'notes', 'Additional notes', 'textarea', FALSE, 'Anything else the specialist should know', NULL, 5, 'active'
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'panel_mcc' AND s.code = 'capacitor_details';
INSERT INTO service_steps (category_id, parent_option_id, code, title, summary, step_kind, sort_order, status)
SELECT c.id, opt.id, 'control_details', 'Problem details', 'Control wiring scope and fault.', 'form', 8, 'active'
FROM service_categories c
JOIN service_steps parent_step ON parent_step.category_id = c.id AND parent_step.code = 'panel_type'
JOIN service_options opt ON opt.step_id = parent_step.id AND opt.code = 'control_wiring'
WHERE c.code = 'panel_mcc';
INSERT INTO service_form_fields (
  step_id, field_key, label, field_type, required, placeholder, help_text, sort_order, status
)
SELECT s.id, 'scope', 'Scope', 'select', TRUE, NULL, NULL, 1, 'active'
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'panel_mcc' AND s.code = 'control_details';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'new_wiring', 'New panel wiring from scratch', NULL, 1, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'panel_mcc' AND s.code = 'control_details' AND f.field_key = 'scope';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'rewiring', 'Rewiring existing panel', NULL, 2, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'panel_mcc' AND s.code = 'control_details' AND f.field_key = 'scope';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'intermittent', 'Intermittent control fault', NULL, 3, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'panel_mcc' AND s.code = 'control_details' AND f.field_key = 'scope';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'relay_timer', 'Relay / timer wiring fault', NULL, 4, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'panel_mcc' AND s.code = 'control_details' AND f.field_key = 'scope';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'plc_io', 'PLC I/O termination', NULL, 5, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'panel_mcc' AND s.code = 'control_details' AND f.field_key = 'scope';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'labelling', 'Panel labelling / ferrule', NULL, 6, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'panel_mcc' AND s.code = 'control_details' AND f.field_key = 'scope';
INSERT INTO service_form_fields (
  step_id, field_key, label, field_type, required, placeholder, help_text, sort_order, status
)
SELECT s.id, 'description', 'Problem description', 'textarea', TRUE, NULL, NULL, 2, 'active'
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'panel_mcc' AND s.code = 'control_details';
INSERT INTO service_form_fields (
  step_id, field_key, label, field_type, required, placeholder, help_text, sort_order, status
)
SELECT s.id, 'urgency', 'Urgency', 'select', TRUE, NULL, NULL, 3, 'active'
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'panel_mcc' AND s.code = 'control_details';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'planned', 'Planned', 'Schedule it', 1, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'panel_mcc' AND s.code = 'control_details' AND f.field_key = 'urgency';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'urgent', 'Urgent', 'Need today', 2, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'panel_mcc' AND s.code = 'control_details' AND f.field_key = 'urgency';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'emergency', 'Emergency', 'Production down', 3, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'panel_mcc' AND s.code = 'control_details' AND f.field_key = 'urgency';
INSERT INTO service_form_fields (
  step_id, field_key, label, field_type, required, placeholder, help_text, sort_order, status
)
SELECT s.id, 'notes', 'Additional notes', 'textarea', FALSE, 'Anything else the specialist should know', NULL, 4, 'active'
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'panel_mcc' AND s.code = 'control_details';

INSERT INTO service_categories (code, name, summary, icon_key, sort_order, status)
VALUES ('cabling', 'Cabling', 'Existing HT/LT, fiber, and LAN fault or rework', 'wrench', 3, 'active');
INSERT INTO service_steps (category_id, code, title, summary, step_kind, sort_order, status)
SELECT id, 'cable_type', 'Service type', 'Repair, re-termination, or rework of existing cabling.', 'choice', 1, 'active'
FROM service_categories
WHERE code = 'cabling';
INSERT INTO service_options (step_id, code, name, summary, sort_order, status, next_action, next_action_label)
SELECT s.id, 'power_ht_lt', 'Power Cable - HT / LT', 'Existing cable fault, re-jointing, re-termination', 1, 'active', NULL, NULL
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'cabling' AND s.code = 'cable_type';
INSERT INTO service_options (step_id, code, name, summary, sort_order, status, next_action, next_action_label)
SELECT s.id, 'instrumentation', 'Instrumentation Cabling', 'Control, signal, and sensor cables', 2, 'active', NULL, NULL
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'cabling' AND s.code = 'cable_type';
INSERT INTO service_options (step_id, code, name, summary, sort_order, status, next_action, next_action_label)
SELECT s.id, 'fiber', 'Fiber Optic', 'Splicing, link fault, OTDR testing', 3, 'active', NULL, NULL
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'cabling' AND s.code = 'cable_type';
INSERT INTO service_options (step_id, code, name, summary, sort_order, status, next_action, next_action_label)
SELECT s.id, 'lan', 'Structured LAN / Network', 'CAT6 fault, patch panel re-termination, port issue', 4, 'active', NULL, NULL
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'cabling' AND s.code = 'cable_type';
INSERT INTO service_steps (category_id, follows_step_id, code, title, summary, step_kind, sort_order, status)
SELECT c.id, prev.id, 'cable_details', 'Cable problem', 'Describe the cable fault or the rework required.', 'form', 2, 'active'
FROM service_categories c
JOIN service_steps prev ON prev.category_id = c.id AND prev.code = 'cable_type'
WHERE c.code = 'cabling';
INSERT INTO service_form_fields (
  step_id, field_key, label, field_type, required, placeholder, help_text, sort_order, status
)
SELECT s.id, 'description', 'Scope of work', 'textarea', TRUE, 'Fault, route, or rework required', NULL, 1, 'active'
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'cabling' AND s.code = 'cable_details';
INSERT INTO service_form_fields (
  step_id, field_key, label, field_type, required, placeholder, help_text, sort_order, status
)
SELECT s.id, 'urgency', 'Urgency', 'select', TRUE, NULL, NULL, 2, 'active'
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'cabling' AND s.code = 'cable_details';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'planned', 'Planned', 'Schedule it', 1, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'cabling' AND s.code = 'cable_details' AND f.field_key = 'urgency';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'urgent', 'Urgent', 'Need today', 2, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'cabling' AND s.code = 'cable_details' AND f.field_key = 'urgency';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'emergency', 'Emergency', 'Production down', 3, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'cabling' AND s.code = 'cable_details' AND f.field_key = 'urgency';
INSERT INTO service_form_fields (
  step_id, field_key, label, field_type, required, placeholder, help_text, sort_order, status
)
SELECT s.id, 'notes', 'Additional notes', 'textarea', FALSE, 'Anything else the specialist should know', NULL, 3, 'active'
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'cabling' AND s.code = 'cable_details';

INSERT INTO service_categories (code, name, summary, icon_key, sort_order, status)
VALUES ('electrical_safety_audit', 'Electrical Safety Audit', 'Safety audit, compliance, and study', 'shield', 4, 'active');
INSERT INTO service_steps (category_id, code, title, summary, step_kind, sort_order, status)
SELECT id, 'audit_type', 'Audit type', 'Select the audit. Certified auditors assess the site and provide a report.', 'choice', 1, 'active'
FROM service_categories
WHERE code = 'electrical_safety_audit';
INSERT INTO service_options (step_id, code, name, summary, sort_order, status, next_action, next_action_label)
SELECT s.id, 'is_5216', 'IS 5216 Electrical Safety', 'Full electrical safety audit and certificate', 1, 'active', NULL, NULL
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'electrical_safety_audit' AND s.code = 'audit_type';
INSERT INTO service_options (step_id, code, name, summary, sort_order, status, next_action, next_action_label)
SELECT s.id, 'fire_noc', 'Fire NOC Compliance', 'Electrical compliance for fire NOC', 2, 'active', NULL, NULL
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'electrical_safety_audit' AND s.code = 'audit_type';
INSERT INTO service_options (step_id, code, name, summary, sort_order, status, next_action, next_action_label)
SELECT s.id, 'energy_audit', 'Energy Audit', 'Load analysis and savings recommendation', 3, 'active', NULL, NULL
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'electrical_safety_audit' AND s.code = 'audit_type';
INSERT INTO service_options (step_id, code, name, summary, sort_order, status, next_action, next_action_label)
SELECT s.id, 'arc_flash', 'Arc Flash Study', 'NFPA 70E, PPE category recommendation', 4, 'active', NULL, NULL
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'electrical_safety_audit' AND s.code = 'audit_type';
INSERT INTO service_steps (category_id, follows_step_id, code, title, summary, step_kind, sort_order, status)
SELECT c.id, prev.id, 'audit_details', 'Audit requirements', 'Scope and how soon the audit is needed.', 'form', 2, 'active'
FROM service_categories c
JOIN service_steps prev ON prev.category_id = c.id AND prev.code = 'audit_type'
WHERE c.code = 'electrical_safety_audit';
INSERT INTO service_form_fields (
  step_id, field_key, label, field_type, required, placeholder, help_text, sort_order, status
)
SELECT s.id, 'description', 'Scope and details', 'textarea', TRUE, 'Areas, panels, or standards to cover', NULL, 1, 'active'
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'electrical_safety_audit' AND s.code = 'audit_details';
INSERT INTO service_form_fields (
  step_id, field_key, label, field_type, required, placeholder, help_text, sort_order, status
)
SELECT s.id, 'urgency', 'Priority', 'select', TRUE, NULL, NULL, 2, 'active'
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'electrical_safety_audit' AND s.code = 'audit_details';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'routine', 'Routine', 'Plan ahead', 1, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'electrical_safety_audit' AND s.code = 'audit_details' AND f.field_key = 'urgency';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'urgent', 'Urgent', 'Need soon', 2, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'electrical_safety_audit' AND s.code = 'audit_details' AND f.field_key = 'urgency';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'deadline', 'Deadline', 'Inspector due', 3, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'electrical_safety_audit' AND s.code = 'audit_details' AND f.field_key = 'urgency';
INSERT INTO service_form_fields (
  step_id, field_key, label, field_type, required, placeholder, help_text, sort_order, status
)
SELECT s.id, 'notes', 'Additional notes', 'textarea', FALSE, 'Preferred schedule notes. The site step collects the visit date.', NULL, 3, 'active'
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'electrical_safety_audit' AND s.code = 'audit_details';

INSERT INTO service_categories (code, name, summary, icon_key, sort_order, status)
VALUES ('vfd_servo', 'VFD / Servo', 'Drive fault or error. An engineer visits the site.', 'device', 5, 'active');
INSERT INTO service_steps (category_id, code, title, summary, step_kind, sort_order, status)
SELECT id, 'work_type', 'Work type', 'Select the drive work. The engineer is matched to the make and fault.', 'choice', 1, 'active'
FROM service_categories
WHERE code = 'vfd_servo';
INSERT INTO service_options (step_id, code, name, summary, sort_order, status, next_action, next_action_label)
SELECT s.id, 'vfd_fault', 'VFD Fault / Not Running', 'Fault code, trip, no output, drive not starting', 1, 'active', NULL, NULL
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'vfd_servo' AND s.code = 'work_type';
INSERT INTO service_options (step_id, code, name, summary, sort_order, status, next_action, next_action_label)
SELECT s.id, 'servo_fault', 'Servo Drive / Amplifier Fault', 'Servo alarm, position error, encoder fault, axis not moving', 2, 'active', NULL, NULL
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'vfd_servo' AND s.code = 'work_type';
INSERT INTO service_options (step_id, code, name, summary, sort_order, status, next_action, next_action_label)
SELECT s.id, 'speed_control', 'Motor Speed / Control Issue', 'Wrong speed, not accelerating, hunting, unstable output', 3, 'active', NULL, NULL
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'vfd_servo' AND s.code = 'work_type';
INSERT INTO service_options (step_id, code, name, summary, sort_order, status, next_action, next_action_label)
SELECT s.id, 'parameters', 'Parameter / Programming Issue', 'Parameters lost, wrong settings, commissioning', 4, 'active', NULL, NULL
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'vfd_servo' AND s.code = 'work_type';
INSERT INTO service_options (step_id, code, name, summary, sort_order, status, next_action, next_action_label)
SELECT s.id, 'dc_drive', 'DC Drive / Thyristor Fault', 'DC drive tripping, thyristor fault, armature issue', 5, 'active', NULL, NULL
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'vfd_servo' AND s.code = 'work_type';
INSERT INTO service_options (step_id, code, name, summary, sort_order, status, next_action, next_action_label)
SELECT s.id, 'communication', 'Communication Fault', 'Fieldbus error, no response from PLC, Modbus or Profibus', 6, 'active', NULL, NULL
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'vfd_servo' AND s.code = 'work_type';
INSERT INTO service_options (step_id, code, name, summary, sort_order, status, next_action, next_action_label)
SELECT s.id, 'breakdown', 'Breakdown / Production Stopped', 'Complete failure, machine down, urgent fault', 7, 'active', NULL, NULL
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'vfd_servo' AND s.code = 'work_type';
INSERT INTO service_steps (category_id, follows_step_id, code, title, summary, step_kind, sort_order, status)
SELECT c.id, prev.id, 'equipment', 'Problem details', 'Model number and fault details help confirm the spare and the visit.', 'form', 2, 'active'
FROM service_categories c
JOIN service_steps prev ON prev.category_id = c.id AND prev.code = 'work_type'
WHERE c.code = 'vfd_servo';
INSERT INTO service_form_fields (
  step_id, field_key, label, field_type, required, placeholder, help_text, sort_order, status
)
SELECT s.id, 'make', 'Make', 'select', FALSE, NULL, NULL, 1, 'active'
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'vfd_servo' AND s.code = 'equipment';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'abb', 'ABB', NULL, 1, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'vfd_servo' AND s.code = 'equipment' AND f.field_key = 'make';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'allen_bradley_rockwell_automation', 'Allen-Bradley (Rockwell Automation)', NULL, 2, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'vfd_servo' AND s.code = 'equipment' AND f.field_key = 'make';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'danfoss', 'Danfoss', NULL, 3, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'vfd_servo' AND s.code = 'equipment' AND f.field_key = 'make';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'delta_electronics', 'Delta Electronics', NULL, 4, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'vfd_servo' AND s.code = 'equipment' AND f.field_key = 'make';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'fuji_electric', 'Fuji Electric', NULL, 5, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'vfd_servo' AND s.code = 'equipment' AND f.field_key = 'make';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'innovative', 'Innovative', NULL, 6, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'vfd_servo' AND s.code = 'equipment' AND f.field_key = 'make';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'l_t', 'L&T', NULL, 7, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'vfd_servo' AND s.code = 'equipment' AND f.field_key = 'make';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'mitsubishi_electric', 'Mitsubishi Electric', NULL, 8, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'vfd_servo' AND s.code = 'equipment' AND f.field_key = 'make';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'schneider_electric', 'Schneider Electric', NULL, 9, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'vfd_servo' AND s.code = 'equipment' AND f.field_key = 'make';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'siemens', 'Siemens', NULL, 10, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'vfd_servo' AND s.code = 'equipment' AND f.field_key = 'make';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'other', 'Other', NULL, 11, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'vfd_servo' AND s.code = 'equipment' AND f.field_key = 'make';
INSERT INTO service_form_fields (
  step_id, field_key, label, field_type, required, placeholder, help_text, sort_order, status
)
SELECT s.id, 'specify_make', 'Specify make', 'text', FALSE, 'If the make is Other', NULL, 2, 'active'
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'vfd_servo' AND s.code = 'equipment';
INSERT INTO service_form_fields (
  step_id, field_key, label, field_type, required, placeholder, help_text, sort_order, status
)
SELECT s.id, 'drive_model', 'Drive model / kW rating', 'text', FALSE, 'Nameplate model', NULL, 3, 'active'
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'vfd_servo' AND s.code = 'equipment';
INSERT INTO service_form_fields (
  step_id, field_key, label, field_type, required, placeholder, help_text, sort_order, status
)
SELECT s.id, 'motor_details', 'Motor details', 'text', FALSE, NULL, NULL, 4, 'active'
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'vfd_servo' AND s.code = 'equipment';
INSERT INTO service_form_fields (
  step_id, field_key, label, field_type, required, placeholder, help_text, sort_order, status
)
SELECT s.id, 'application', 'Application / machine', 'select', FALSE, NULL, NULL, 5, 'active'
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'vfd_servo' AND s.code = 'equipment';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'pump_water_cooling', 'Pump (water/cooling)', NULL, 1, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'vfd_servo' AND s.code = 'equipment' AND f.field_key = 'application';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'compressor', 'Compressor', NULL, 2, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'vfd_servo' AND s.code = 'equipment' AND f.field_key = 'application';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'conveyor', 'Conveyor', NULL, 3, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'vfd_servo' AND s.code = 'equipment' AND f.field_key = 'application';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'fan_blower', 'Fan / Blower', NULL, 4, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'vfd_servo' AND s.code = 'equipment' AND f.field_key = 'application';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'crane_hoist', 'Crane / Hoist', NULL, 5, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'vfd_servo' AND s.code = 'equipment' AND f.field_key = 'application';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'extruder', 'Extruder', NULL, 6, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'vfd_servo' AND s.code = 'equipment' AND f.field_key = 'application';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'cnc_machine', 'CNC Machine', NULL, 7, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'vfd_servo' AND s.code = 'equipment' AND f.field_key = 'application';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'mixer_agitator', 'Mixer / Agitator', NULL, 8, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'vfd_servo' AND s.code = 'equipment' AND f.field_key = 'application';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'other', 'Other', NULL, 9, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'vfd_servo' AND s.code = 'equipment' AND f.field_key = 'application';
INSERT INTO service_form_fields (
  step_id, field_key, label, field_type, required, placeholder, help_text, sort_order, status
)
SELECT s.id, 'fault_type', 'Fault type', 'select', TRUE, NULL, NULL, 6, 'active'
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'vfd_servo' AND s.code = 'equipment';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'overcurrent', 'Overcurrent', NULL, 1, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'vfd_servo' AND s.code = 'equipment' AND f.field_key = 'fault_type';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'overvoltage', 'Overvoltage', NULL, 2, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'vfd_servo' AND s.code = 'equipment' AND f.field_key = 'fault_type';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'undervoltage', 'Undervoltage', NULL, 3, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'vfd_servo' AND s.code = 'equipment' AND f.field_key = 'fault_type';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'overtemperature', 'Overtemperature', NULL, 4, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'vfd_servo' AND s.code = 'equipment' AND f.field_key = 'fault_type';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'earth_fault', 'Earth fault', NULL, 5, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'vfd_servo' AND s.code = 'equipment' AND f.field_key = 'fault_type';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'motor_not_starting', 'Motor not starting', NULL, 6, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'vfd_servo' AND s.code = 'equipment' AND f.field_key = 'fault_type';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'speed_not_stable', 'Speed not stable', NULL, 7, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'vfd_servo' AND s.code = 'equipment' AND f.field_key = 'fault_type';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'display_blank', 'Display blank', NULL, 8, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'vfd_servo' AND s.code = 'equipment' AND f.field_key = 'fault_type';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'tripping_on_load', 'Tripping on load', NULL, 9, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'vfd_servo' AND s.code = 'equipment' AND f.field_key = 'fault_type';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'noise_vibration', 'Noise / vibration', NULL, 10, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'vfd_servo' AND s.code = 'equipment' AND f.field_key = 'fault_type';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'commissioning', 'Commissioning', NULL, 11, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'vfd_servo' AND s.code = 'equipment' AND f.field_key = 'fault_type';
INSERT INTO service_form_fields (
  step_id, field_key, label, field_type, required, placeholder, help_text, sort_order, status
)
SELECT s.id, 'fault_code', 'Fault code', 'text', FALSE, 'Code on the drive display', 'Enter the code exactly as shown.', 7, 'active'
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'vfd_servo' AND s.code = 'equipment';
INSERT INTO service_form_fields (
  step_id, field_key, label, field_type, required, placeholder, help_text, sort_order, status
)
SELECT s.id, 'description', 'Problem description', 'textarea', TRUE, NULL, NULL, 8, 'active'
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'vfd_servo' AND s.code = 'equipment';
INSERT INTO service_form_fields (
  step_id, field_key, label, field_type, required, placeholder, help_text, sort_order, status
)
SELECT s.id, 'urgency', 'Urgency', 'select', TRUE, NULL, NULL, 9, 'active'
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'vfd_servo' AND s.code = 'equipment';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'planned', 'Planned', 'Schedule it', 1, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'vfd_servo' AND s.code = 'equipment' AND f.field_key = 'urgency';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'urgent', 'Urgent', 'Need today', 2, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'vfd_servo' AND s.code = 'equipment' AND f.field_key = 'urgency';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'emergency', 'Emergency', 'Production down', 3, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'vfd_servo' AND s.code = 'equipment' AND f.field_key = 'urgency';
INSERT INTO service_form_fields (
  step_id, field_key, label, field_type, required, placeholder, help_text, sort_order, status
)
SELECT s.id, 'notes', 'Additional notes', 'textarea', FALSE, 'Anything else the specialist should know', NULL, 10, 'active'
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'vfd_servo' AND s.code = 'equipment';

INSERT INTO service_categories (code, name, summary, icon_key, sort_order, status)
VALUES ('plc', 'PLC', 'PLC make, work type, fault, programming, update, or repair', 'device', 6, 'active');
INSERT INTO service_steps (category_id, code, title, summary, step_kind, sort_order, status)
SELECT id, 'plc_make', 'PLC make', 'Which brand is the PLC?', 'choice', 1, 'active'
FROM service_categories
WHERE code = 'plc';
INSERT INTO service_options (step_id, code, name, summary, sort_order, status, next_action, next_action_label)
SELECT s.id, 'siemens', 'Siemens SIMATIC', 'S7-200 / S7-300 / S7-400 / S7-1200 / S7-1500', 1, 'active', NULL, NULL
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'plc' AND s.code = 'plc_make';
INSERT INTO service_options (step_id, code, name, summary, sort_order, status, next_action, next_action_label)
SELECT s.id, 'allen_bradley', 'Allen Bradley / Rockwell', 'MicroLogix / CompactLogix / ControlLogix', 2, 'active', NULL, NULL
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'plc' AND s.code = 'plc_make';
INSERT INTO service_options (step_id, code, name, summary, sort_order, status, next_action, next_action_label)
SELECT s.id, 'mitsubishi', 'Mitsubishi MELSEC', 'FX / Q / iQ-R / iQ-F series', 3, 'active', NULL, NULL
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'plc' AND s.code = 'plc_make';
INSERT INTO service_options (step_id, code, name, summary, sort_order, status, next_action, next_action_label)
SELECT s.id, 'delta', 'Delta DVP / AS series', 'DVP series / AS series', 4, 'active', NULL, NULL
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'plc' AND s.code = 'plc_make';
INSERT INTO service_options (step_id, code, name, summary, sort_order, status, next_action, next_action_label)
SELECT s.id, 'schneider', 'Schneider / Modicon', 'M221 / M241 / M340 / Premium', 5, 'active', NULL, NULL
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'plc' AND s.code = 'plc_make';
INSERT INTO service_options (step_id, code, name, summary, sort_order, status, next_action, next_action_label)
SELECT s.id, 'omron', 'Omron', 'CP1 / CJ2 / NX / NJ series', 6, 'active', NULL, NULL
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'plc' AND s.code = 'plc_make';
INSERT INTO service_options (step_id, code, name, summary, sort_order, status, next_action, next_action_label)
SELECT s.id, 'beckhoff', 'Beckhoff', 'CX / EK / AX series', 7, 'active', NULL, NULL
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'plc' AND s.code = 'plc_make';
INSERT INTO service_options (step_id, code, name, summary, sort_order, status, next_action, next_action_label)
SELECT s.id, 'other', 'Other make', 'Fanuc, Bosch, B&R, ABB, and others', 8, 'active', NULL, NULL
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'plc' AND s.code = 'plc_make';
INSERT INTO service_steps (category_id, parent_option_id, code, title, summary, step_kind, sort_order, status)
SELECT c.id, opt.id, 'plc_other_make', 'Specify PLC make', 'Enter the manufacturer when it is not in the list.', 'form', 2, 'active'
FROM service_categories c
JOIN service_steps parent_step ON parent_step.category_id = c.id AND parent_step.code = 'plc_make'
JOIN service_options opt ON opt.step_id = parent_step.id AND opt.code = 'other'
WHERE c.code = 'plc';
INSERT INTO service_form_fields (
  step_id, field_key, label, field_type, required, placeholder, help_text, sort_order, status
)
SELECT s.id, 'specify_make', 'Specify make', 'text', TRUE, 'Manufacturer name', NULL, 1, 'active'
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'plc' AND s.code = 'plc_other_make';
INSERT INTO service_steps (category_id, follows_step_id, code, title, summary, step_kind, sort_order, status)
SELECT c.id, prev.id, 'plc_work', 'Work type', 'What do you need on this PLC?', 'choice', 3, 'active'
FROM service_categories c
JOIN service_steps prev ON prev.category_id = c.id AND prev.code = 'plc_make'
WHERE c.code = 'plc';
INSERT INTO service_options (step_id, code, name, summary, sort_order, status, next_action, next_action_label)
SELECT s.id, 'fault', 'Error / Fault - not working', 'CPU stopped, fault light, machine not running', 1, 'active', NULL, NULL
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'plc' AND s.code = 'plc_work';
INSERT INTO service_options (step_id, code, name, summary, sort_order, status, next_action, next_action_label)
SELECT s.id, 'programming', 'Programming / Logic Change', 'New program, modify logic, add I/O', 2, 'active', NULL, NULL
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'plc' AND s.code = 'plc_work';
INSERT INTO service_options (step_id, code, name, summary, sort_order, status, next_action, next_action_label)
SELECT s.id, 'update', 'Update / Version Upgrade', 'Firmware, software, add module, backup', 3, 'active', NULL, NULL
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'plc' AND s.code = 'plc_work';
INSERT INTO service_options (step_id, code, name, summary, sort_order, status, next_action, next_action_label)
SELECT s.id, 'repair', 'Repair - Hardware Damage', 'PCB burnt, card fault, physical damage', 4, 'active', NULL, NULL
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'plc' AND s.code = 'plc_work';
INSERT INTO service_steps (category_id, parent_option_id, code, title, summary, step_kind, sort_order, status)
SELECT c.id, opt.id, 'plc_fault', 'Fault details', 'Power, lights, and the error shown on the PLC or HMI.', 'form', 4, 'active'
FROM service_categories c
JOIN service_steps parent_step ON parent_step.category_id = c.id AND parent_step.code = 'plc_work'
JOIN service_options opt ON opt.step_id = parent_step.id AND opt.code = 'fault'
WHERE c.code = 'plc';
INSERT INTO service_form_fields (
  step_id, field_key, label, field_type, required, placeholder, help_text, sort_order, status
)
SELECT s.id, 'cpu_model', 'CPU / model number', 'text', FALSE, NULL, NULL, 1, 'active'
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'plc' AND s.code = 'plc_fault';
INSERT INTO service_form_fields (
  step_id, field_key, label, field_type, required, placeholder, help_text, sort_order, status
)
SELECT s.id, 'power_status', 'Power status', 'select', TRUE, NULL, NULL, 2, 'active'
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'plc' AND s.code = 'plc_fault';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'running', 'Power ON - CPU running', 'Powered but the machine is not working correctly', 1, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'plc' AND s.code = 'plc_fault' AND f.field_key = 'power_status';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'stopped', 'Power ON - CPU stopped / fault', 'PLC powered but CPU in STOP or fault', 2, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'plc' AND s.code = 'plc_fault' AND f.field_key = 'power_status';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'dead', 'No power - completely dead', 'No display, no lights, PLC not responding', 3, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'plc' AND s.code = 'plc_fault' AND f.field_key = 'power_status';
INSERT INTO service_form_fields (
  step_id, field_key, label, field_type, required, placeholder, help_text, sort_order, status
)
SELECT s.id, 'indicator_lights', 'Indicator lights', 'multiselect', FALSE, NULL, NULL, 3, 'active'
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'plc' AND s.code = 'plc_fault';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'cpu_sf_fault_light_on', 'CPU / SF fault light ON', NULL, 1, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'plc' AND s.code = 'plc_fault' AND f.field_key = 'indicator_lights';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'battery_low_light_on', 'Battery low light ON', NULL, 2, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'plc' AND s.code = 'plc_fault' AND f.field_key = 'indicator_lights';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'i_o_error_light_on', 'I/O error light ON', NULL, 3, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'plc' AND s.code = 'plc_fault' AND f.field_key = 'indicator_lights';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'communication_error_light', 'Communication error light', NULL, 4, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'plc' AND s.code = 'plc_fault' AND f.field_key = 'indicator_lights';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'bf_bus_fault_light_on', 'BF (Bus Fault) light ON', NULL, 5, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'plc' AND s.code = 'plc_fault' AND f.field_key = 'indicator_lights';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'all_lights_normal_but_not_working', 'All lights normal - but not working', NULL, 6, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'plc' AND s.code = 'plc_fault' AND f.field_key = 'indicator_lights';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'no_lights_at_all', 'No lights at all', NULL, 7, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'plc' AND s.code = 'plc_fault' AND f.field_key = 'indicator_lights';
INSERT INTO service_form_fields (
  step_id, field_key, label, field_type, required, placeholder, help_text, sort_order, status
)
SELECT s.id, 'error_code', 'Error code / message', 'text', FALSE, NULL, 'Enter exactly as shown. This helps the engineer diagnose before arriving.', 4, 'active'
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'plc' AND s.code = 'plc_fault';
INSERT INTO service_form_fields (
  step_id, field_key, label, field_type, required, placeholder, help_text, sort_order, status
)
SELECT s.id, 'symptoms', 'Symptoms', 'multiselect', FALSE, NULL, NULL, 5, 'active'
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'plc' AND s.code = 'plc_fault';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'cpu_in_stop_mode', 'CPU in STOP mode', NULL, 1, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'plc' AND s.code = 'plc_fault' AND f.field_key = 'symptoms';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'program_lost_memory_fault', 'Program lost / memory fault', NULL, 2, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'plc' AND s.code = 'plc_fault' AND f.field_key = 'symptoms';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'i_o_not_responding', 'I/O not responding', NULL, 3, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'plc' AND s.code = 'plc_fault' AND f.field_key = 'symptoms';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'hmi_not_connecting_to_plc', 'HMI not connecting to PLC', NULL, 4, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'plc' AND s.code = 'plc_fault' AND f.field_key = 'symptoms';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'communication_lost_profibus_profinet', 'Communication lost (Profibus/Profinet)', NULL, 5, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'plc' AND s.code = 'plc_fault' AND f.field_key = 'symptoms';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'analog_signal_wrong_noisy', 'Analog signal wrong / noisy', NULL, 6, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'plc' AND s.code = 'plc_fault' AND f.field_key = 'symptoms';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'program_running_but_wrong_output', 'Program running but wrong output', NULL, 7, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'plc' AND s.code = 'plc_fault' AND f.field_key = 'symptoms';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'after_power_cut_not_restarting', 'After power cut - not restarting', NULL, 8, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'plc' AND s.code = 'plc_fault' AND f.field_key = 'symptoms';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'after_maintenance_stopped_working', 'After maintenance - stopped working', NULL, 9, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'plc' AND s.code = 'plc_fault' AND f.field_key = 'symptoms';
INSERT INTO service_form_fields (
  step_id, field_key, label, field_type, required, placeholder, help_text, sort_order, status
)
SELECT s.id, 'started_when', 'When did it start?', 'select', FALSE, NULL, NULL, 6, 'active'
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'plc' AND s.code = 'plc_fault';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'today', 'Just now / today', NULL, 1, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'plc' AND s.code = 'plc_fault' AND f.field_key = 'started_when';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'few_days', 'Few days ago', NULL, 2, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'plc' AND s.code = 'plc_fault' AND f.field_key = 'started_when';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'after_maintenance', 'After maintenance / modification', NULL, 3, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'plc' AND s.code = 'plc_fault' AND f.field_key = 'started_when';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'intermittent', 'Intermittent - comes and goes', NULL, 4, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'plc' AND s.code = 'plc_fault' AND f.field_key = 'started_when';
INSERT INTO service_form_fields (
  step_id, field_key, label, field_type, required, placeholder, help_text, sort_order, status
)
SELECT s.id, 'urgency', 'Urgency', 'select', TRUE, NULL, NULL, 7, 'active'
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'plc' AND s.code = 'plc_fault';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'planned', 'Planned', 'Schedule it', 1, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'plc' AND s.code = 'plc_fault' AND f.field_key = 'urgency';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'urgent', 'Urgent', 'Need today', 2, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'plc' AND s.code = 'plc_fault' AND f.field_key = 'urgency';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'emergency', 'Emergency', 'Production down', 3, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'plc' AND s.code = 'plc_fault' AND f.field_key = 'urgency';
INSERT INTO service_form_fields (
  step_id, field_key, label, field_type, required, placeholder, help_text, sort_order, status
)
SELECT s.id, 'notes', 'Additional notes', 'textarea', FALSE, 'Anything else the specialist should know', NULL, 8, 'active'
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'plc' AND s.code = 'plc_fault';
INSERT INTO service_steps (category_id, parent_option_id, code, title, summary, step_kind, sort_order, status)
SELECT c.id, opt.id, 'plc_programming', 'Programming details', 'Share what needs to be programmed or changed.', 'form', 5, 'active'
FROM service_categories c
JOIN service_steps parent_step ON parent_step.category_id = c.id AND parent_step.code = 'plc_work'
JOIN service_options opt ON opt.step_id = parent_step.id AND opt.code = 'programming'
WHERE c.code = 'plc';
INSERT INTO service_form_fields (
  step_id, field_key, label, field_type, required, placeholder, help_text, sort_order, status
)
SELECT s.id, 'cpu_model', 'CPU / model number', 'text', FALSE, NULL, NULL, 1, 'active'
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'plc' AND s.code = 'plc_programming';
INSERT INTO service_form_fields (
  step_id, field_key, label, field_type, required, placeholder, help_text, sort_order, status
)
SELECT s.id, 'program_available', 'Is the program available?', 'select', TRUE, NULL, NULL, 2, 'active'
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'plc' AND s.code = 'plc_programming';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'yes', 'Yes - existing program available', 'Backup or online copy is accessible', 1, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'plc' AND s.code = 'plc_programming' AND f.field_key = 'program_available';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'partial', 'Partial - needs to be read from PLC', 'Program is in the PLC but there is no backup', 2, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'plc' AND s.code = 'plc_programming' AND f.field_key = 'program_available';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'no', 'No - new program needed', 'Fresh programming required', 3, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'plc' AND s.code = 'plc_programming' AND f.field_key = 'program_available';
INSERT INTO service_form_fields (
  step_id, field_key, label, field_type, required, placeholder, help_text, sort_order, status
)
SELECT s.id, 'work_needed', 'What needs to be done?', 'multiselect', TRUE, NULL, NULL, 3, 'active'
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'plc' AND s.code = 'plc_programming';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'add_new_i_o_points', 'Add new I/O points', NULL, 1, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'plc' AND s.code = 'plc_programming' AND f.field_key = 'work_needed';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'change_sequence_logic', 'Change sequence / logic', NULL, 2, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'plc' AND s.code = 'plc_programming' AND f.field_key = 'work_needed';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'new_machine_integration', 'New machine integration', NULL, 3, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'plc' AND s.code = 'plc_programming' AND f.field_key = 'work_needed';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'pid_closed_loop_tuning', 'PID / closed loop tuning', NULL, 4, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'plc' AND s.code = 'plc_programming' AND f.field_key = 'work_needed';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'communication_setup', 'Communication setup', NULL, 5, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'plc' AND s.code = 'plc_programming' AND f.field_key = 'work_needed';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'hmi_screen_programming', 'HMI screen programming', NULL, 6, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'plc' AND s.code = 'plc_programming' AND f.field_key = 'work_needed';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'full_fresh_program', 'Full fresh program', NULL, 7, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'plc' AND s.code = 'plc_programming' AND f.field_key = 'work_needed';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'program_documentation', 'Program documentation', NULL, 8, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'plc' AND s.code = 'plc_programming' AND f.field_key = 'work_needed';
INSERT INTO service_form_fields (
  step_id, field_key, label, field_type, required, placeholder, help_text, sort_order, status
)
SELECT s.id, 'description', 'Description', 'textarea', TRUE, NULL, NULL, 4, 'active'
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'plc' AND s.code = 'plc_programming';
INSERT INTO service_form_fields (
  step_id, field_key, label, field_type, required, placeholder, help_text, sort_order, status
)
SELECT s.id, 'urgency', 'Urgency', 'select', TRUE, NULL, NULL, 5, 'active'
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'plc' AND s.code = 'plc_programming';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'planned', 'Planned', 'Schedule it', 1, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'plc' AND s.code = 'plc_programming' AND f.field_key = 'urgency';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'urgent', 'Urgent', 'Need today', 2, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'plc' AND s.code = 'plc_programming' AND f.field_key = 'urgency';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'emergency', 'Emergency', 'Production waiting', 3, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'plc' AND s.code = 'plc_programming' AND f.field_key = 'urgency';
INSERT INTO service_form_fields (
  step_id, field_key, label, field_type, required, placeholder, help_text, sort_order, status
)
SELECT s.id, 'notes', 'Additional notes', 'textarea', FALSE, 'Anything else the specialist should know', NULL, 6, 'active'
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'plc' AND s.code = 'plc_programming';
INSERT INTO service_steps (category_id, parent_option_id, code, title, summary, step_kind, sort_order, status)
SELECT c.id, opt.id, 'plc_update', 'Update details', 'Current version and what needs to be updated. Take a program backup before a firmware upgrade.', 'form', 6, 'active'
FROM service_categories c
JOIN service_steps parent_step ON parent_step.category_id = c.id AND parent_step.code = 'plc_work'
JOIN service_options opt ON opt.step_id = parent_step.id AND opt.code = 'update'
WHERE c.code = 'plc';
INSERT INTO service_form_fields (
  step_id, field_key, label, field_type, required, placeholder, help_text, sort_order, status
)
SELECT s.id, 'cpu_model', 'CPU / model number', 'text', FALSE, NULL, NULL, 1, 'active'
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'plc' AND s.code = 'plc_update';
INSERT INTO service_form_fields (
  step_id, field_key, label, field_type, required, placeholder, help_text, sort_order, status
)
SELECT s.id, 'current_version', 'Current version', 'text', FALSE, 'If known', NULL, 2, 'active'
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'plc' AND s.code = 'plc_update';
INSERT INTO service_form_fields (
  step_id, field_key, label, field_type, required, placeholder, help_text, sort_order, status
)
SELECT s.id, 'update_items', 'What to update?', 'multiselect', TRUE, NULL, NULL, 3, 'active'
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'plc' AND s.code = 'plc_update';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'firmware_upgrade', 'Firmware upgrade', NULL, 1, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'plc' AND s.code = 'plc_update' AND f.field_key = 'update_items';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'software_version_upgrade', 'Software version upgrade', NULL, 2, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'plc' AND s.code = 'plc_update' AND f.field_key = 'update_items';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'add_new_i_o_module', 'Add new I/O module', NULL, 3, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'plc' AND s.code = 'plc_update' AND f.field_key = 'update_items';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'program_backup_needed', 'Program backup needed', NULL, 4, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'plc' AND s.code = 'plc_update' AND f.field_key = 'update_items';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'replace_battery', 'Replace battery', NULL, 5, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'plc' AND s.code = 'plc_update' AND f.field_key = 'update_items';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'memory_card_upgrade', 'Memory card upgrade', NULL, 6, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'plc' AND s.code = 'plc_update' AND f.field_key = 'update_items';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'communication_card_add', 'Communication card add', NULL, 7, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'plc' AND s.code = 'plc_update' AND f.field_key = 'update_items';
INSERT INTO service_form_fields (
  step_id, field_key, label, field_type, required, placeholder, help_text, sort_order, status
)
SELECT s.id, 'description', 'Description', 'textarea', FALSE, NULL, NULL, 4, 'active'
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'plc' AND s.code = 'plc_update';
INSERT INTO service_form_fields (
  step_id, field_key, label, field_type, required, placeholder, help_text, sort_order, status
)
SELECT s.id, 'urgency', 'Urgency', 'select', TRUE, NULL, NULL, 5, 'active'
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'plc' AND s.code = 'plc_update';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'planned', 'Planned', 'Schedule it', 1, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'plc' AND s.code = 'plc_update' AND f.field_key = 'urgency';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'urgent', 'Urgent', 'Need today', 2, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'plc' AND s.code = 'plc_update' AND f.field_key = 'urgency';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'emergency', 'Emergency', 'Production at risk', 3, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'plc' AND s.code = 'plc_update' AND f.field_key = 'urgency';
INSERT INTO service_form_fields (
  step_id, field_key, label, field_type, required, placeholder, help_text, sort_order, status
)
SELECT s.id, 'notes', 'Additional notes', 'textarea', FALSE, 'Anything else the specialist should know', NULL, 6, 'active'
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'plc' AND s.code = 'plc_update';
INSERT INTO service_steps (category_id, parent_option_id, code, title, summary, step_kind, sort_order, status)
SELECT c.id, opt.id, 'plc_repair_path', 'Repair path', 'Hardware damage can be assessed on site or sent for bench repair.', 'choice', 7, 'active'
FROM service_categories c
JOIN service_steps parent_step ON parent_step.category_id = c.id AND parent_step.code = 'plc_work'
JOIN service_options opt ON opt.step_id = parent_step.id AND opt.code = 'repair'
WHERE c.code = 'plc';
INSERT INTO service_options (step_id, code, name, summary, sort_order, status, next_action, next_action_label)
SELECT s.id, 'on_site', 'Book an on-site visit', 'An engineer visits first to assess the damage', 1, 'active', NULL, NULL
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'plc' AND s.code = 'plc_repair_path';
INSERT INTO service_options (step_id, code, name, summary, sort_order, status, next_action, next_action_label)
SELECT s.id, 'workshop', 'Send to the repair center', 'Component-level diagnosis at the workshop', 2, 'active', 'repair_center', 'Open repair center'
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'plc' AND s.code = 'plc_repair_path';
INSERT INTO service_steps (category_id, parent_option_id, code, title, summary, step_kind, sort_order, status)
SELECT c.id, opt.id, 'plc_repair_onsite', 'Repair details', 'Describe the hardware damage for the site visit.', 'form', 8, 'active'
FROM service_categories c
JOIN service_steps parent_step ON parent_step.category_id = c.id AND parent_step.code = 'plc_repair_path'
JOIN service_options opt ON opt.step_id = parent_step.id AND opt.code = 'on_site'
WHERE c.code = 'plc';
INSERT INTO service_form_fields (
  step_id, field_key, label, field_type, required, placeholder, help_text, sort_order, status
)
SELECT s.id, 'cpu_model', 'CPU / model number', 'text', FALSE, NULL, NULL, 1, 'active'
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'plc' AND s.code = 'plc_repair_onsite';
INSERT INTO service_form_fields (
  step_id, field_key, label, field_type, required, placeholder, help_text, sort_order, status
)
SELECT s.id, 'description', 'Damage description', 'textarea', TRUE, 'PCB, card, or physical damage', NULL, 2, 'active'
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'plc' AND s.code = 'plc_repair_onsite';
INSERT INTO service_form_fields (
  step_id, field_key, label, field_type, required, placeholder, help_text, sort_order, status
)
SELECT s.id, 'urgency', 'Urgency', 'select', TRUE, NULL, NULL, 3, 'active'
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'plc' AND s.code = 'plc_repair_onsite';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'planned', 'Planned', 'Schedule it', 1, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'plc' AND s.code = 'plc_repair_onsite' AND f.field_key = 'urgency';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'urgent', 'Urgent', 'Need today', 2, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'plc' AND s.code = 'plc_repair_onsite' AND f.field_key = 'urgency';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'emergency', 'Emergency', 'Production down', 3, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'plc' AND s.code = 'plc_repair_onsite' AND f.field_key = 'urgency';
INSERT INTO service_form_fields (
  step_id, field_key, label, field_type, required, placeholder, help_text, sort_order, status
)
SELECT s.id, 'notes', 'Additional notes', 'textarea', FALSE, 'Anything else the specialist should know', NULL, 4, 'active'
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'plc' AND s.code = 'plc_repair_onsite';
INSERT INTO service_steps (category_id, parent_option_id, code, title, summary, step_kind, sort_order, status)
SELECT c.id, opt.id, 'plc_repair_workshop', 'Repair details', 'Describe the hardware damage for workshop repair.', 'form', 9, 'active'
FROM service_categories c
JOIN service_steps parent_step ON parent_step.category_id = c.id AND parent_step.code = 'plc_repair_path'
JOIN service_options opt ON opt.step_id = parent_step.id AND opt.code = 'workshop'
WHERE c.code = 'plc';
INSERT INTO service_form_fields (
  step_id, field_key, label, field_type, required, placeholder, help_text, sort_order, status
)
SELECT s.id, 'cpu_model', 'CPU / model number', 'text', FALSE, NULL, NULL, 1, 'active'
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'plc' AND s.code = 'plc_repair_workshop';
INSERT INTO service_form_fields (
  step_id, field_key, label, field_type, required, placeholder, help_text, sort_order, status
)
SELECT s.id, 'description', 'Damage description', 'textarea', TRUE, 'PCB, burnt board, or physical damage', NULL, 2, 'active'
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'plc' AND s.code = 'plc_repair_workshop';
INSERT INTO service_form_fields (
  step_id, field_key, label, field_type, required, placeholder, help_text, sort_order, status
)
SELECT s.id, 'urgency', 'Urgency', 'select', TRUE, NULL, NULL, 3, 'active'
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'plc' AND s.code = 'plc_repair_workshop';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'planned', 'Planned', 'Schedule it', 1, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'plc' AND s.code = 'plc_repair_workshop' AND f.field_key = 'urgency';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'urgent', 'Urgent', 'Need today', 2, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'plc' AND s.code = 'plc_repair_workshop' AND f.field_key = 'urgency';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'emergency', 'Emergency', 'Production down', 3, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'plc' AND s.code = 'plc_repair_workshop' AND f.field_key = 'urgency';
INSERT INTO service_form_fields (
  step_id, field_key, label, field_type, required, placeholder, help_text, sort_order, status
)
SELECT s.id, 'notes', 'Additional notes', 'textarea', FALSE, 'Anything else the specialist should know', NULL, 4, 'active'
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'plc' AND s.code = 'plc_repair_workshop';

INSERT INTO service_categories (code, name, summary, icon_key, sort_order, status)
VALUES ('hmi', 'HMI', 'HMI manufacturer and service details', 'device', 7, 'active');
INSERT INTO service_steps (category_id, code, title, summary, step_kind, sort_order, status)
SELECT id, 'hmi_make', 'HMI make', 'Which brand is the HMI?', 'choice', 1, 'active'
FROM service_categories
WHERE code = 'hmi';
INSERT INTO service_options (step_id, code, name, summary, sort_order, status, next_action, next_action_label)
SELECT s.id, 'siemens', 'Siemens SIMATIC HMI', 'KTP / KP / TP / Comfort panels', 1, 'active', NULL, NULL
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'hmi' AND s.code = 'hmi_make';
INSERT INTO service_options (step_id, code, name, summary, sort_order, status, next_action, next_action_label)
SELECT s.id, 'allen_bradley', 'Allen Bradley PanelView', 'PanelView Plus / PanelView 800', 2, 'active', NULL, NULL
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'hmi' AND s.code = 'hmi_make';
INSERT INTO service_options (step_id, code, name, summary, sort_order, status, next_action, next_action_label)
SELECT s.id, 'mitsubishi', 'Mitsubishi GOT', 'GOT2000 / GOT1000 series', 3, 'active', NULL, NULL
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'hmi' AND s.code = 'hmi_make';
INSERT INTO service_options (step_id, code, name, summary, sort_order, status, next_action, next_action_label)
SELECT s.id, 'delta', 'Delta DOP series', 'DOP-100 / DOP-B series', 4, 'active', NULL, NULL
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'hmi' AND s.code = 'hmi_make';
INSERT INTO service_options (step_id, code, name, summary, sort_order, status, next_action, next_action_label)
SELECT s.id, 'weintek', 'Weintek / Weinview', 'cMT / eMT / MT series', 5, 'active', NULL, NULL
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'hmi' AND s.code = 'hmi_make';
INSERT INTO service_options (step_id, code, name, summary, sort_order, status, next_action, next_action_label)
SELECT s.id, 'proface', 'Proface / Schneider Magelis', 'GP / LT / ST series', 6, 'active', NULL, NULL
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'hmi' AND s.code = 'hmi_make';
INSERT INTO service_options (step_id, code, name, summary, sort_order, status, next_action, next_action_label)
SELECT s.id, 'other', 'Other make', 'Beijer, Red Lion, Omron, and others', 7, 'active', NULL, NULL
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'hmi' AND s.code = 'hmi_make';
INSERT INTO service_steps (category_id, parent_option_id, code, title, summary, step_kind, sort_order, status)
SELECT c.id, opt.id, 'hmi_other_make', 'Specify HMI make', 'Enter the manufacturer when it is not in the list.', 'form', 2, 'active'
FROM service_categories c
JOIN service_steps parent_step ON parent_step.category_id = c.id AND parent_step.code = 'hmi_make'
JOIN service_options opt ON opt.step_id = parent_step.id AND opt.code = 'other'
WHERE c.code = 'hmi';
INSERT INTO service_form_fields (
  step_id, field_key, label, field_type, required, placeholder, help_text, sort_order, status
)
SELECT s.id, 'specify_make', 'Specify make', 'text', TRUE, 'Manufacturer name', NULL, 1, 'active'
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'hmi' AND s.code = 'hmi_other_make';
INSERT INTO service_steps (category_id, follows_step_id, code, title, summary, step_kind, sort_order, status)
SELECT c.id, prev.id, 'hmi_service', 'HMI service', 'What needs to be done on this HMI?', 'choice', 3, 'active'
FROM service_categories c
JOIN service_steps prev ON prev.category_id = c.id AND prev.code = 'hmi_make'
WHERE c.code = 'hmi';
INSERT INTO service_options (step_id, code, name, summary, sort_order, status, next_action, next_action_label)
SELECT s.id, 'screen_blank', 'Screen blank / not starting', NULL, 1, 'active', NULL, NULL
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'hmi' AND s.code = 'hmi_service';
INSERT INTO service_options (step_id, code, name, summary, sort_order, status, next_action, next_action_label)
SELECT s.id, 'not_connecting', 'Not connecting to PLC', NULL, 2, 'active', NULL, NULL
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'hmi' AND s.code = 'hmi_service';
INSERT INTO service_options (step_id, code, name, summary, sort_order, status, next_action, next_action_label)
SELECT s.id, 'programming', 'Screen programming / modification', NULL, 3, 'active', NULL, NULL
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'hmi' AND s.code = 'hmi_service';
INSERT INTO service_options (step_id, code, name, summary, sort_order, status, next_action, next_action_label)
SELECT s.id, 'touch', 'Touchscreen not working', NULL, 4, 'active', NULL, NULL
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'hmi' AND s.code = 'hmi_service';
INSERT INTO service_options (step_id, code, name, summary, sort_order, status, next_action, next_action_label)
SELECT s.id, 'firmware', 'Software / firmware update', NULL, 5, 'active', NULL, NULL
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'hmi' AND s.code = 'hmi_service';
INSERT INTO service_steps (category_id, follows_step_id, code, title, summary, step_kind, sort_order, status)
SELECT c.id, prev.id, 'hmi_details', 'HMI details', 'Model and the status shown on the screen.', 'form', 4, 'active'
FROM service_categories c
JOIN service_steps prev ON prev.category_id = c.id AND prev.code = 'hmi_service'
WHERE c.code = 'hmi';
INSERT INTO service_form_fields (
  step_id, field_key, label, field_type, required, placeholder, help_text, sort_order, status
)
SELECT s.id, 'hmi_model', 'HMI model', 'text', FALSE, NULL, NULL, 1, 'active'
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'hmi' AND s.code = 'hmi_details';
INSERT INTO service_form_fields (
  step_id, field_key, label, field_type, required, placeholder, help_text, sort_order, status
)
SELECT s.id, 'indicator_status', 'Indicator / error status', 'select', TRUE, NULL, NULL, 2, 'active'
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'hmi' AND s.code = 'hmi_details';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'blank', 'Screen completely blank', NULL, 1, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'hmi' AND s.code = 'hmi_details' AND f.field_key = 'indicator_status';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'error', 'Screen on but showing error', NULL, 2, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'hmi' AND s.code = 'hmi_details' AND f.field_key = 'indicator_status';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'wrong_data', 'Screen working - wrong data', NULL, 3, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'hmi' AND s.code = 'hmi_details' AND f.field_key = 'indicator_status';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'connection', 'Connection error on screen', NULL, 4, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'hmi' AND s.code = 'hmi_details' AND f.field_key = 'indicator_status';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'no_power', 'No power light', NULL, 5, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'hmi' AND s.code = 'hmi_details' AND f.field_key = 'indicator_status';
INSERT INTO service_form_fields (
  step_id, field_key, label, field_type, required, placeholder, help_text, sort_order, status
)
SELECT s.id, 'error_message', 'Error message', 'text', FALSE, 'If shown', NULL, 3, 'active'
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'hmi' AND s.code = 'hmi_details';
INSERT INTO service_form_fields (
  step_id, field_key, label, field_type, required, placeholder, help_text, sort_order, status
)
SELECT s.id, 'urgency', 'Urgency', 'select', TRUE, NULL, NULL, 4, 'active'
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'hmi' AND s.code = 'hmi_details';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'planned', 'Planned', 'Schedule it', 1, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'hmi' AND s.code = 'hmi_details' AND f.field_key = 'urgency';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'urgent', 'Urgent', 'Need today', 2, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'hmi' AND s.code = 'hmi_details' AND f.field_key = 'urgency';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'emergency', 'Emergency', 'Production down', 3, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'hmi' AND s.code = 'hmi_details' AND f.field_key = 'urgency';
INSERT INTO service_form_fields (
  step_id, field_key, label, field_type, required, placeholder, help_text, sort_order, status
)
SELECT s.id, 'notes', 'Additional notes', 'textarea', FALSE, 'Anything else the specialist should know', NULL, 5, 'active'
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'hmi' AND s.code = 'hmi_details';

INSERT INTO service_categories (code, name, summary, icon_key, sort_order, status)
VALUES ('scada', 'SCADA', 'SCADA platform and service details', 'device', 8, 'active');
INSERT INTO service_steps (category_id, code, title, summary, step_kind, sort_order, status)
SELECT id, 'scada_platform', 'SCADA platform', 'Which SCADA software is on this site?', 'choice', 1, 'active'
FROM service_categories
WHERE code = 'scada';
INSERT INTO service_options (step_id, code, name, summary, sort_order, status, next_action, next_action_label)
SELECT s.id, 'wincc', 'Siemens WinCC', 'WinCC Basic / Comfort / Advanced / Unified', 1, 'active', NULL, NULL
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'scada' AND s.code = 'scada_platform';
INSERT INTO service_options (step_id, code, name, summary, sort_order, status, next_action, next_action_label)
SELECT s.id, 'wonderware', 'Wonderware / AVEVA', 'InTouch / System Platform / Edge', 2, 'active', NULL, NULL
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'scada' AND s.code = 'scada_platform';
INSERT INTO service_options (step_id, code, name, summary, sort_order, status, next_action, next_action_label)
SELECT s.id, 'ignition', 'Ignition (Inductive Automation)', 'Ignition 8.x / Edge', 3, 'active', NULL, NULL
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'scada' AND s.code = 'scada_platform';
INSERT INTO service_options (step_id, code, name, summary, sort_order, status, next_action, next_action_label)
SELECT s.id, 'factorytalk', 'FactoryTalk / Rockwell', 'FactoryTalk View / ME / SE', 4, 'active', NULL, NULL
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'scada' AND s.code = 'scada_platform';
INSERT INTO service_options (step_id, code, name, summary, sort_order, status, next_action, next_action_label)
SELECT s.id, 'other', 'Other SCADA', 'DIAView, Citect, custom, and others', 5, 'active', NULL, NULL
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'scada' AND s.code = 'scada_platform';
INSERT INTO service_steps (category_id, parent_option_id, code, title, summary, step_kind, sort_order, status)
SELECT c.id, opt.id, 'scada_other_platform', 'Specify SCADA platform', 'Enter the manufacturer when it is not in the list.', 'form', 2, 'active'
FROM service_categories c
JOIN service_steps parent_step ON parent_step.category_id = c.id AND parent_step.code = 'scada_platform'
JOIN service_options opt ON opt.step_id = parent_step.id AND opt.code = 'other'
WHERE c.code = 'scada';
INSERT INTO service_form_fields (
  step_id, field_key, label, field_type, required, placeholder, help_text, sort_order, status
)
SELECT s.id, 'specify_make', 'Specify make', 'text', TRUE, 'Manufacturer name', NULL, 1, 'active'
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'scada' AND s.code = 'scada_other_platform';
INSERT INTO service_steps (category_id, follows_step_id, code, title, summary, step_kind, sort_order, status)
SELECT c.id, prev.id, 'scada_service', 'SCADA service', 'What needs to be done on this SCADA system?', 'choice', 3, 'active'
FROM service_categories c
JOIN service_steps prev ON prev.category_id = c.id AND prev.code = 'scada_platform'
WHERE c.code = 'scada';
INSERT INTO service_options (step_id, code, name, summary, sort_order, status, next_action, next_action_label)
SELECT s.id, 'not_running', 'SCADA not running / error', NULL, 1, 'active', NULL, NULL
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'scada' AND s.code = 'scada_service';
INSERT INTO service_options (step_id, code, name, summary, sort_order, status, next_action, next_action_label)
SELECT s.id, 'new_screen', 'New screen / tag development', NULL, 2, 'active', NULL, NULL
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'scada' AND s.code = 'scada_service';
INSERT INTO service_options (step_id, code, name, summary, sort_order, status, next_action, next_action_label)
SELECT s.id, 'communication', 'PLC / device not communicating', NULL, 3, 'active', NULL, NULL
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'scada' AND s.code = 'scada_service';
INSERT INTO service_options (step_id, code, name, summary, sort_order, status, next_action, next_action_label)
SELECT s.id, 'upgrade', 'Software upgrade / migration', NULL, 4, 'active', NULL, NULL
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'scada' AND s.code = 'scada_service';
INSERT INTO service_options (step_id, code, name, summary, sort_order, status, next_action, next_action_label)
SELECT s.id, 'reports', 'Reports / data logging issue', NULL, 5, 'active', NULL, NULL
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'scada' AND s.code = 'scada_service';
INSERT INTO service_steps (category_id, follows_step_id, code, title, summary, step_kind, sort_order, status)
SELECT c.id, prev.id, 'scada_details', 'SCADA details', 'Current status and any message on screen.', 'form', 4, 'active'
FROM service_categories c
JOIN service_steps prev ON prev.category_id = c.id AND prev.code = 'scada_service'
WHERE c.code = 'scada';
INSERT INTO service_form_fields (
  step_id, field_key, label, field_type, required, placeholder, help_text, sort_order, status
)
SELECT s.id, 'error_status', 'Error / status', 'select', TRUE, NULL, NULL, 1, 'active'
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'scada' AND s.code = 'scada_details';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'not_starting', 'SCADA software not starting', NULL, 1, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'scada' AND s.code = 'scada_details' AND f.field_key = 'error_status';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'communication', 'Communication error in SCADA', NULL, 2, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'scada' AND s.code = 'scada_details' AND f.field_key = 'error_status';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'wrong_tags', 'Tags showing wrong values', NULL, 3, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'scada' AND s.code = 'scada_details' AND f.field_key = 'error_status';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'alarms', 'Alarms not working', NULL, 4, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'scada' AND s.code = 'scada_details' AND f.field_key = 'error_status';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'modification', 'Running - but need modification', NULL, 5, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'scada' AND s.code = 'scada_details' AND f.field_key = 'error_status';
INSERT INTO service_form_fields (
  step_id, field_key, label, field_type, required, placeholder, help_text, sort_order, status
)
SELECT s.id, 'error_message', 'Error message', 'text', FALSE, 'If shown', NULL, 2, 'active'
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'scada' AND s.code = 'scada_details';
INSERT INTO service_form_fields (
  step_id, field_key, label, field_type, required, placeholder, help_text, sort_order, status
)
SELECT s.id, 'description', 'Description', 'textarea', FALSE, NULL, NULL, 3, 'active'
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'scada' AND s.code = 'scada_details';
INSERT INTO service_form_fields (
  step_id, field_key, label, field_type, required, placeholder, help_text, sort_order, status
)
SELECT s.id, 'urgency', 'Urgency', 'select', TRUE, NULL, NULL, 4, 'active'
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'scada' AND s.code = 'scada_details';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'planned', 'Planned', 'Schedule it', 1, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'scada' AND s.code = 'scada_details' AND f.field_key = 'urgency';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'urgent', 'Urgent', 'Need today', 2, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'scada' AND s.code = 'scada_details' AND f.field_key = 'urgency';
INSERT INTO service_field_options (field_id, value, label, summary, sort_order, status)
SELECT f.id, 'emergency', 'Emergency', 'Plant monitoring down', 3, 'active'
FROM service_form_fields f
JOIN service_steps s ON s.id = f.step_id
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'scada' AND s.code = 'scada_details' AND f.field_key = 'urgency';
INSERT INTO service_form_fields (
  step_id, field_key, label, field_type, required, placeholder, help_text, sort_order, status
)
SELECT s.id, 'notes', 'Additional notes', 'textarea', FALSE, 'Anything else the specialist should know', NULL, 5, 'active'
FROM service_steps s
JOIN service_categories c ON c.id = s.category_id
WHERE c.code = 'scada' AND s.code = 'scada_details';

DO $$
BEGIN

  IF NOT EXISTS (
    SELECT 1 FROM service_steps s
    JOIN service_categories c ON c.id = s.category_id
    WHERE c.code = 'electrician' AND s.code = 'work_type'
  ) THEN
    RAISE EXCEPTION 'service booking seed missing %.%', 'electrician', 'work_type';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM service_steps s
    JOIN service_categories c ON c.id = s.category_id
    WHERE c.code = 'electrician' AND s.code = 'problem'
  ) THEN
    RAISE EXCEPTION 'service booking seed missing %.%', 'electrician', 'problem';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM service_steps s
    JOIN service_categories c ON c.id = s.category_id
    WHERE c.code = 'panel_mcc' AND s.code = 'panel_type'
  ) THEN
    RAISE EXCEPTION 'service booking seed missing %.%', 'panel_mcc', 'panel_type';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM service_steps s
    JOIN service_categories c ON c.id = s.category_id
    WHERE c.code = 'panel_mcc' AND s.code = 'vfd_panel_make'
  ) THEN
    RAISE EXCEPTION 'service booking seed missing %.%', 'panel_mcc', 'vfd_panel_make';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM service_steps s
    JOIN service_categories c ON c.id = s.category_id
    WHERE c.code = 'panel_mcc' AND s.code = 'vfd_panel_other'
  ) THEN
    RAISE EXCEPTION 'service booking seed missing %.%', 'panel_mcc', 'vfd_panel_other';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM service_steps s
    JOIN service_categories c ON c.id = s.category_id
    WHERE c.code = 'panel_mcc' AND s.code = 'mcc_details'
  ) THEN
    RAISE EXCEPTION 'service booking seed missing %.%', 'panel_mcc', 'mcc_details';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM service_steps s
    JOIN service_categories c ON c.id = s.category_id
    WHERE c.code = 'panel_mcc' AND s.code = 'vfd_panel_details'
  ) THEN
    RAISE EXCEPTION 'service booking seed missing %.%', 'panel_mcc', 'vfd_panel_details';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM service_steps s
    JOIN service_categories c ON c.id = s.category_id
    WHERE c.code = 'panel_mcc' AND s.code = 'busbar_details'
  ) THEN
    RAISE EXCEPTION 'service booking seed missing %.%', 'panel_mcc', 'busbar_details';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM service_steps s
    JOIN service_categories c ON c.id = s.category_id
    WHERE c.code = 'panel_mcc' AND s.code = 'capacitor_details'
  ) THEN
    RAISE EXCEPTION 'service booking seed missing %.%', 'panel_mcc', 'capacitor_details';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM service_steps s
    JOIN service_categories c ON c.id = s.category_id
    WHERE c.code = 'panel_mcc' AND s.code = 'control_details'
  ) THEN
    RAISE EXCEPTION 'service booking seed missing %.%', 'panel_mcc', 'control_details';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM service_steps s
    JOIN service_categories c ON c.id = s.category_id
    WHERE c.code = 'cabling' AND s.code = 'cable_type'
  ) THEN
    RAISE EXCEPTION 'service booking seed missing %.%', 'cabling', 'cable_type';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM service_steps s
    JOIN service_categories c ON c.id = s.category_id
    WHERE c.code = 'cabling' AND s.code = 'cable_details'
  ) THEN
    RAISE EXCEPTION 'service booking seed missing %.%', 'cabling', 'cable_details';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM service_steps s
    JOIN service_categories c ON c.id = s.category_id
    WHERE c.code = 'electrical_safety_audit' AND s.code = 'audit_type'
  ) THEN
    RAISE EXCEPTION 'service booking seed missing %.%', 'electrical_safety_audit', 'audit_type';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM service_steps s
    JOIN service_categories c ON c.id = s.category_id
    WHERE c.code = 'electrical_safety_audit' AND s.code = 'audit_details'
  ) THEN
    RAISE EXCEPTION 'service booking seed missing %.%', 'electrical_safety_audit', 'audit_details';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM service_steps s
    JOIN service_categories c ON c.id = s.category_id
    WHERE c.code = 'vfd_servo' AND s.code = 'work_type'
  ) THEN
    RAISE EXCEPTION 'service booking seed missing %.%', 'vfd_servo', 'work_type';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM service_steps s
    JOIN service_categories c ON c.id = s.category_id
    WHERE c.code = 'vfd_servo' AND s.code = 'equipment'
  ) THEN
    RAISE EXCEPTION 'service booking seed missing %.%', 'vfd_servo', 'equipment';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM service_steps s
    JOIN service_categories c ON c.id = s.category_id
    WHERE c.code = 'plc' AND s.code = 'plc_make'
  ) THEN
    RAISE EXCEPTION 'service booking seed missing %.%', 'plc', 'plc_make';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM service_steps s
    JOIN service_categories c ON c.id = s.category_id
    WHERE c.code = 'plc' AND s.code = 'plc_other_make'
  ) THEN
    RAISE EXCEPTION 'service booking seed missing %.%', 'plc', 'plc_other_make';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM service_steps s
    JOIN service_categories c ON c.id = s.category_id
    WHERE c.code = 'plc' AND s.code = 'plc_work'
  ) THEN
    RAISE EXCEPTION 'service booking seed missing %.%', 'plc', 'plc_work';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM service_steps s
    JOIN service_categories c ON c.id = s.category_id
    WHERE c.code = 'plc' AND s.code = 'plc_fault'
  ) THEN
    RAISE EXCEPTION 'service booking seed missing %.%', 'plc', 'plc_fault';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM service_steps s
    JOIN service_categories c ON c.id = s.category_id
    WHERE c.code = 'plc' AND s.code = 'plc_programming'
  ) THEN
    RAISE EXCEPTION 'service booking seed missing %.%', 'plc', 'plc_programming';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM service_steps s
    JOIN service_categories c ON c.id = s.category_id
    WHERE c.code = 'plc' AND s.code = 'plc_update'
  ) THEN
    RAISE EXCEPTION 'service booking seed missing %.%', 'plc', 'plc_update';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM service_steps s
    JOIN service_categories c ON c.id = s.category_id
    WHERE c.code = 'plc' AND s.code = 'plc_repair_path'
  ) THEN
    RAISE EXCEPTION 'service booking seed missing %.%', 'plc', 'plc_repair_path';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM service_steps s
    JOIN service_categories c ON c.id = s.category_id
    WHERE c.code = 'plc' AND s.code = 'plc_repair_onsite'
  ) THEN
    RAISE EXCEPTION 'service booking seed missing %.%', 'plc', 'plc_repair_onsite';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM service_steps s
    JOIN service_categories c ON c.id = s.category_id
    WHERE c.code = 'plc' AND s.code = 'plc_repair_workshop'
  ) THEN
    RAISE EXCEPTION 'service booking seed missing %.%', 'plc', 'plc_repair_workshop';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM service_steps s
    JOIN service_categories c ON c.id = s.category_id
    WHERE c.code = 'hmi' AND s.code = 'hmi_make'
  ) THEN
    RAISE EXCEPTION 'service booking seed missing %.%', 'hmi', 'hmi_make';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM service_steps s
    JOIN service_categories c ON c.id = s.category_id
    WHERE c.code = 'hmi' AND s.code = 'hmi_other_make'
  ) THEN
    RAISE EXCEPTION 'service booking seed missing %.%', 'hmi', 'hmi_other_make';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM service_steps s
    JOIN service_categories c ON c.id = s.category_id
    WHERE c.code = 'hmi' AND s.code = 'hmi_service'
  ) THEN
    RAISE EXCEPTION 'service booking seed missing %.%', 'hmi', 'hmi_service';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM service_steps s
    JOIN service_categories c ON c.id = s.category_id
    WHERE c.code = 'hmi' AND s.code = 'hmi_details'
  ) THEN
    RAISE EXCEPTION 'service booking seed missing %.%', 'hmi', 'hmi_details';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM service_steps s
    JOIN service_categories c ON c.id = s.category_id
    WHERE c.code = 'scada' AND s.code = 'scada_platform'
  ) THEN
    RAISE EXCEPTION 'service booking seed missing %.%', 'scada', 'scada_platform';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM service_steps s
    JOIN service_categories c ON c.id = s.category_id
    WHERE c.code = 'scada' AND s.code = 'scada_other_platform'
  ) THEN
    RAISE EXCEPTION 'service booking seed missing %.%', 'scada', 'scada_other_platform';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM service_steps s
    JOIN service_categories c ON c.id = s.category_id
    WHERE c.code = 'scada' AND s.code = 'scada_service'
  ) THEN
    RAISE EXCEPTION 'service booking seed missing %.%', 'scada', 'scada_service';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM service_steps s
    JOIN service_categories c ON c.id = s.category_id
    WHERE c.code = 'scada' AND s.code = 'scada_details'
  ) THEN
    RAISE EXCEPTION 'service booking seed missing %.%', 'scada', 'scada_details';
  END IF;
END $$;
