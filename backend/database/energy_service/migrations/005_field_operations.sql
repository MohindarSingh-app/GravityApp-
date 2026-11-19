-- Field work for the dashboard: jobs, signals, AMC, certificates, and the service menu.
-- The menu rows are the product catalogue. Customer jobs are created by the API.

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS service_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(40) NOT NULL,
  name VARCHAR(120) NOT NULL,
  category VARCHAR(32) NOT NULL,
  summary VARCHAR(240) NOT NULL,
  same_day BOOLEAN NOT NULL DEFAULT FALSE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT service_catalog_code_unique UNIQUE (code),
  CONSTRAINT service_catalog_category_check CHECK (category IN ('quick', 'project', 'repair'))
);

CREATE TABLE IF NOT EXISTS spare_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku VARCHAR(40) NOT NULL,
  name VARCHAR(120) NOT NULL,
  summary VARCHAR(240) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT spare_catalog_sku_unique UNIQUE (sku)
);

CREATE TABLE IF NOT EXISTS field_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  site_id UUID REFERENCES sites (id) ON DELETE SET NULL,
  code VARCHAR(24) NOT NULL,
  title VARCHAR(160) NOT NULL,
  category VARCHAR(32) NOT NULL,
  priority VARCHAR(20) NOT NULL DEFAULT 'scheduled',
  status VARCHAR(24) NOT NULL DEFAULT 'open',
  location_label VARCHAR(160),
  engineer_name VARCHAR(120),
  engineer_trade VARCHAR(80),
  rating NUMERIC(2, 1),
  estimate_amount INTEGER,
  sla_due_at TIMESTAMPTZ,
  eta_minutes INTEGER,
  notes VARCHAR(500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT field_jobs_code_unique UNIQUE (code),
  CONSTRAINT field_jobs_category_check CHECK (category IN ('job', 'quick', 'project')),
  CONSTRAINT field_jobs_priority_check CHECK (priority IN ('emergency', 'scheduled')),
  CONSTRAINT field_jobs_status_check CHECK (status IN ('open', 'on_the_way', 'in_progress', 'completed', 'cancelled')),
  CONSTRAINT field_jobs_title_check CHECK (char_length(btrim(title)) >= 2)
);

CREATE INDEX IF NOT EXISTS field_jobs_company_idx ON field_jobs (company_id, created_at DESC);

DROP TRIGGER IF EXISTS field_jobs_set_updated_at ON field_jobs;
CREATE TRIGGER field_jobs_set_updated_at
  BEFORE UPDATE ON field_jobs
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS field_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  site_id UUID REFERENCES sites (id) ON DELETE SET NULL,
  job_id UUID REFERENCES field_jobs (id) ON DELETE SET NULL,
  kind VARCHAR(32) NOT NULL,
  title VARCHAR(160) NOT NULL,
  detail VARCHAR(400) NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'open',
  eta_minutes INTEGER,
  actor_name VARCHAR(120),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT field_signals_kind_check CHECK (kind IN ('emergency', 'recommendation', 'transit', 'repair_send_in', 'expert')),
  CONSTRAINT field_signals_status_check CHECK (status IN ('open', 'closed'))
);

CREATE INDEX IF NOT EXISTS field_signals_company_idx ON field_signals (company_id, created_at DESC);

CREATE TABLE IF NOT EXISTS amc_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  site_id UUID REFERENCES sites (id) ON DELETE SET NULL,
  title VARCHAR(160) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'quoted',
  discount_percent INTEGER,
  quote_hours INTEGER NOT NULL DEFAULT 48,
  coverage VARCHAR(240) NOT NULL,
  priority_response BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT amc_plans_status_check CHECK (status IN ('quoted', 'active', 'expired')),
  CONSTRAINT amc_plans_title_check CHECK (char_length(btrim(title)) >= 2)
);

CREATE INDEX IF NOT EXISTS amc_plans_company_idx ON amc_plans (company_id, created_at DESC);

DROP TRIGGER IF EXISTS amc_plans_set_updated_at ON amc_plans;
CREATE TRIGGER amc_plans_set_updated_at
  BEFORE UPDATE ON amc_plans
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS compliance_certs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  site_id UUID REFERENCES sites (id) ON DELETE SET NULL,
  name VARCHAR(160) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT compliance_certs_name_check CHECK (char_length(btrim(name)) >= 2)
);

CREATE INDEX IF NOT EXISTS compliance_certs_company_idx ON compliance_certs (company_id, expires_at);

INSERT INTO service_catalog (code, name, category, summary, same_day)
VALUES
  ('panel', 'Panel service', 'quick', 'Fault finding on MCC and distribution panels.', TRUE),
  ('plc', 'PLC service', 'quick', 'Program and I/O checks on the plant PLC.', TRUE),
  ('cabling', 'Cabling', 'quick', 'Power and control cable repair on site.', TRUE),
  ('install', 'New installation', 'project', 'Panel, drive, or line installation.', FALSE),
  ('workshop', 'Workshop repair', 'repair', 'Component repair for a VFD, PLC, or HMI.', FALSE)
ON CONFLICT (code) DO NOTHING;

INSERT INTO spare_catalog (sku, name, summary)
VALUES
  ('vfd-module', 'VFD power module', 'Replacement module for a variable frequency drive.'),
  ('plc-cpu', 'PLC processor', 'Processor card for the site PLC rack.'),
  ('hmi-panel', 'HMI panel', 'Operator panel for the machine face.')
ON CONFLICT (sku) DO NOTHING;
