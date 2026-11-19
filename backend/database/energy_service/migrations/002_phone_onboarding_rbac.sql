-- Extends the existing auth schema. Safe to run more than once.
-- Reuses users + refresh_sessions. Does not create a second auth or session store.

ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE users ALTER COLUMN full_name DROP NOT NULL;

ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS company_id UUID;
ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active';
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_status VARCHAR(40) NOT NULL DEFAULT 'OTP_PENDING';

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('owner', 'admin', 'manager', 'user'));

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_status_check;
ALTER TABLE users ADD CONSTRAINT users_status_check
  CHECK (status IN ('active', 'inactive', 'suspended'));

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_onboarding_status_check;
ALTER TABLE users ADD CONSTRAINT users_onboarding_status_check
  CHECK (onboarding_status IN (
    'OTP_PENDING',
    'PHONE_VERIFIED',
    'COMPANY_PENDING',
    'COMPANY_COMPLETED',
    'SITES_PENDING',
    'SITES_COMPLETED',
    'PROFILE_PENDING',
    'ONBOARDING_COMPLETED'
  ));

CREATE UNIQUE INDEX IF NOT EXISTS users_phone_unique_idx
  ON users (phone)
  WHERE phone IS NOT NULL;

CREATE INDEX IF NOT EXISTS users_company_id_idx ON users (company_id);
CREATE INDEX IF NOT EXISTS users_onboarding_status_idx ON users (onboarding_status);
CREATE INDEX IF NOT EXISTS users_status_idx ON users (status);

CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  company_name VARCHAR(200) NOT NULL,
  gstin VARCHAR(15) NOT NULL,
  industry VARCHAR(80) NOT NULL,
  city VARCHAR(80) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  onboarding_status VARCHAR(40) NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT companies_gstin_unique UNIQUE (gstin),
  CONSTRAINT companies_status_check CHECK (status IN ('active', 'inactive')),
  CONSTRAINT companies_onboarding_status_check CHECK (onboarding_status IN ('PENDING', 'COMPLETED')),
  CONSTRAINT companies_gstin_format_check CHECK (gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'),
  CONSTRAINT companies_name_check CHECK (char_length(btrim(company_name)) >= 2)
);

CREATE INDEX IF NOT EXISTS companies_owner_user_id_idx ON companies (owner_user_id);
CREATE INDEX IF NOT EXISTS companies_city_idx ON companies (city);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_company_id_fkey'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_company_id_fkey
      FOREIGN KEY (company_id) REFERENCES companies (id) ON DELETE SET NULL;
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  site_name VARCHAR(160) NOT NULL,
  full_address VARCHAR(500) NOT NULL,
  city VARCHAR(80) NOT NULL,
  state VARCHAR(80),
  country VARCHAR(80) NOT NULL DEFAULT 'India',
  latitude NUMERIC(9, 6) NOT NULL,
  longitude NUMERIC(9, 6) NOT NULL,
  site_type VARCHAR(20) NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT sites_type_check CHECK (site_type IN ('factory', 'plant', 'warehouse')),
  CONSTRAINT sites_status_check CHECK (status IN ('active', 'inactive')),
  CONSTRAINT sites_name_check CHECK (char_length(btrim(site_name)) >= 2),
  CONSTRAINT sites_latitude_check CHECK (latitude >= -90 AND latitude <= 90),
  CONSTRAINT sites_longitude_check CHECK (longitude >= -180 AND longitude <= 180)
);

CREATE INDEX IF NOT EXISTS sites_company_id_idx ON sites (company_id);
CREATE INDEX IF NOT EXISTS sites_city_idx ON sites (city);
CREATE UNIQUE INDEX IF NOT EXISTS sites_one_primary_per_company_idx
  ON sites (company_id)
  WHERE is_primary = TRUE AND status = 'active';

CREATE TABLE IF NOT EXISTS otp_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone VARCHAR(20) NOT NULL,
  purpose VARCHAR(32) NOT NULL,
  otp_hash CHAR(64) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  cooldown_until TIMESTAMPTZ,
  ip_address INET,
  user_agent VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT otp_verifications_purpose_check CHECK (purpose IN ('login', 'password_reset')),
  CONSTRAINT otp_verifications_attempt_count_check CHECK (attempt_count >= 0)
);

CREATE INDEX IF NOT EXISTS otp_verifications_phone_purpose_idx
  ON otp_verifications (phone, purpose, created_at DESC);
CREATE INDEX IF NOT EXISTS otp_verifications_expires_at_idx ON otp_verifications (expires_at);

CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(32) NOT NULL,
  description VARCHAR(160) NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT roles_name_unique UNIQUE (name)
);

CREATE TABLE IF NOT EXISTS permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(64) NOT NULL,
  description VARCHAR(160) NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT permissions_name_unique UNIQUE (name)
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id UUID NOT NULL REFERENCES roles (id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, role_id)
);

CREATE INDEX IF NOT EXISTS user_roles_role_id_idx ON user_roles (role_id);

CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies (id) ON DELETE CASCADE,
  name VARCHAR(80) NOT NULL,
  key_prefix VARCHAR(16) NOT NULL,
  key_hash CHAR(64) NOT NULL,
  scopes TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  revoke_reason VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT api_keys_hash_unique UNIQUE (key_hash),
  CONSTRAINT api_keys_name_check CHECK (char_length(btrim(name)) >= 2)
);

CREATE INDEX IF NOT EXISTS api_keys_user_id_idx ON api_keys (user_id);
CREATE INDEX IF NOT EXISTS api_keys_company_id_idx ON api_keys (company_id);
CREATE INDEX IF NOT EXISTS api_keys_prefix_idx ON api_keys (key_prefix);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users (id) ON DELETE SET NULL,
  action VARCHAR(64) NOT NULL,
  entity_type VARCHAR(64),
  entity_id UUID,
  ip_address INET,
  user_agent VARCHAR(255),
  request_id VARCHAR(64),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS audit_logs_user_id_idx ON audit_logs (user_id);
CREATE INDEX IF NOT EXISTS audit_logs_action_idx ON audit_logs (action);
CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_entity_idx ON audit_logs (entity_type, entity_id);

INSERT INTO roles (name, description) VALUES
  ('owner', 'Company owner with full access'),
  ('admin', 'Company administrator'),
  ('manager', 'Site and operations manager'),
  ('user', 'Standard company user')
ON CONFLICT (name) DO NOTHING;

INSERT INTO permissions (name, description) VALUES
  ('companies:create', 'Create a company'),
  ('companies:read', 'Read company details'),
  ('companies:update', 'Update company details'),
  ('sites:create', 'Create sites'),
  ('sites:read', 'Read sites'),
  ('sites:update', 'Update sites'),
  ('sites:delete', 'Delete sites'),
  ('profile:read', 'Read own profile'),
  ('profile:update', 'Update own profile'),
  ('sessions:read', 'List own sessions'),
  ('sessions:revoke', 'Revoke own sessions'),
  ('api_keys:create', 'Create API keys'),
  ('api_keys:read', 'List API keys'),
  ('api_keys:revoke', 'Revoke API keys'),
  ('api_keys:rotate', 'Rotate API keys'),
  ('audit:read', 'Read audit logs'),
  ('roles:manage', 'Change member roles')
ON CONFLICT (name) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'owner'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.name IN (
  'companies:create', 'companies:read', 'companies:update',
  'sites:create', 'sites:read', 'sites:update', 'sites:delete',
  'profile:read', 'profile:update',
  'sessions:read', 'sessions:revoke',
  'api_keys:create', 'api_keys:read', 'api_keys:revoke', 'api_keys:rotate',
  'audit:read'
)
WHERE r.name = 'admin'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.name IN (
  'companies:read',
  'sites:create', 'sites:read', 'sites:update',
  'profile:read', 'profile:update',
  'sessions:read', 'sessions:revoke'
)
WHERE r.name = 'manager'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.name IN (
  'companies:create', 'companies:read',
  'sites:read',
  'profile:read', 'profile:update',
  'sessions:read', 'sessions:revoke'
)
WHERE r.name = 'user'
ON CONFLICT DO NOTHING;

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u
JOIN roles r ON r.name = u.role
ON CONFLICT DO NOTHING;

DROP TRIGGER IF EXISTS companies_set_updated_at ON companies;
CREATE TRIGGER companies_set_updated_at
BEFORE UPDATE ON companies
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS sites_set_updated_at ON sites;
CREATE TRIGGER sites_set_updated_at
BEFORE UPDATE ON sites
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS otp_verifications_set_updated_at ON otp_verifications;
CREATE TRIGGER otp_verifications_set_updated_at
BEFORE UPDATE ON otp_verifications
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS roles_set_updated_at ON roles;
CREATE TRIGGER roles_set_updated_at
BEFORE UPDATE ON roles
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS permissions_set_updated_at ON permissions;
CREATE TRIGGER permissions_set_updated_at
BEFORE UPDATE ON permissions
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS api_keys_set_updated_at ON api_keys;
CREATE TRIGGER api_keys_set_updated_at
BEFORE UPDATE ON api_keys
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
