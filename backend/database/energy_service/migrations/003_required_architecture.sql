-- Aligns the database to the required tables:
-- companies, users, roles, sites, otp_verifications, sessions, api_keys, audit_logs.
-- Copies existing data, then drops duplicate auth, role, and permission tables.

ALTER TABLE roles ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active';

ALTER TABLE roles DROP CONSTRAINT IF EXISTS roles_status_check;
ALTER TABLE roles ADD CONSTRAINT roles_status_check
  CHECK (status IN ('active', 'inactive'));

INSERT INTO roles (name, description, status) VALUES
  ('owner', 'Company owner with full access', 'active'),
  ('admin', 'Company administrator', 'active'),
  ('manager', 'Site and operations manager', 'active'),
  ('user', 'Standard company user', 'active')
ON CONFLICT (name) DO NOTHING;

ALTER TABLE users ADD COLUMN IF NOT EXISTS role_id UUID;
ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(120);
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE users
SET name = full_name
WHERE name IS NULL AND full_name IS NOT NULL;

UPDATE users
SET email_verified = TRUE
WHERE email_verified_at IS NOT NULL;

UPDATE users
SET phone_verified = TRUE
WHERE phone_verified_at IS NOT NULL;

UPDATE users u
SET role_id = r.id
FROM roles r
WHERE u.role_id IS NULL AND r.name = u.role;

UPDATE users
SET role_id = (SELECT id FROM roles WHERE name = 'user')
WHERE role_id IS NULL;

ALTER TABLE users ALTER COLUMN role_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_role_id_fkey'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_role_id_fkey
      FOREIGN KEY (role_id) REFERENCES roles (id) ON DELETE RESTRICT;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS users_role_id_idx ON users (role_id);

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_onboarding_status_check;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_failed_login_count_check;

DROP INDEX IF EXISTS users_onboarding_status_idx;

ALTER TABLE users DROP COLUMN IF EXISTS role;
ALTER TABLE users DROP COLUMN IF EXISTS full_name;
ALTER TABLE users DROP COLUMN IF EXISTS email_verified_at;
ALTER TABLE users DROP COLUMN IF EXISTS phone_verified_at;
ALTER TABLE users DROP COLUMN IF EXISTS onboarding_status;
ALTER TABLE users DROP COLUMN IF EXISTS failed_login_count;
ALTER TABLE users DROP COLUMN IF EXISTS locked_until;
ALTER TABLE users DROP COLUMN IF EXISTS password_changed_at;

DROP TABLE IF EXISTS role_permissions;
DROP TABLE IF EXISTS user_roles;
DROP TABLE IF EXISTS permissions;
DROP TABLE IF EXISTS password_reset_tokens;
DROP TABLE IF EXISTS email_verification_tokens;

ALTER TABLE companies ADD COLUMN IF NOT EXISTS legal_name VARCHAR(200);
ALTER TABLE companies ADD COLUMN IF NOT EXISTS state VARCHAR(80);
ALTER TABLE companies ADD COLUMN IF NOT EXISTS country VARCHAR(80) NOT NULL DEFAULT 'India';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS pincode VARCHAR(12);
ALTER TABLE companies ADD COLUMN IF NOT EXISTS address VARCHAR(500);

ALTER TABLE companies DROP CONSTRAINT IF EXISTS companies_status_check;
ALTER TABLE companies ADD CONSTRAINT companies_status_check
  CHECK (status IN ('active', 'inactive', 'suspended'));

ALTER TABLE companies DROP CONSTRAINT IF EXISTS companies_onboarding_status_check;
ALTER TABLE companies DROP COLUMN IF EXISTS onboarding_status;
ALTER TABLE companies DROP COLUMN IF EXISTS owner_user_id;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'gstin'
  ) THEN
    ALTER TABLE companies RENAME COLUMN gstin TO gst_number;
  END IF;
END
$$;

ALTER TABLE companies DROP CONSTRAINT IF EXISTS companies_gstin_unique;
ALTER TABLE companies DROP CONSTRAINT IF EXISTS companies_gst_number_unique;
ALTER TABLE companies ADD CONSTRAINT companies_gst_number_unique UNIQUE (gst_number);

DROP INDEX IF EXISTS companies_owner_user_id_idx;

ALTER TABLE sites ADD COLUMN IF NOT EXISTS pincode VARCHAR(12);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sites' AND column_name = 'full_address'
  ) THEN
    ALTER TABLE sites RENAME COLUMN full_address TO address;
  END IF;
END
$$;

ALTER TABLE sites DROP CONSTRAINT IF EXISTS sites_type_check;
ALTER TABLE sites ADD CONSTRAINT sites_type_check
  CHECK (site_type IN ('factory', 'plant', 'warehouse', 'office', 'other'));

ALTER TABLE otp_verifications ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE otp_verifications ADD COLUMN IF NOT EXISTS identifier VARCHAR(255);
ALTER TABLE otp_verifications ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
ALTER TABLE otp_verifications ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'pending';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'otp_verifications' AND column_name = 'phone'
  ) THEN
    UPDATE otp_verifications SET identifier = phone WHERE identifier IS NULL;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'otp_verifications' AND column_name = 'otp_hash'
  ) THEN
    ALTER TABLE otp_verifications RENAME COLUMN otp_hash TO otp_code;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'otp_verifications' AND column_name = 'attempt_count'
  ) THEN
    ALTER TABLE otp_verifications RENAME COLUMN attempt_count TO attempts;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'otp_verifications' AND column_name = 'consumed_at'
  ) THEN
    UPDATE otp_verifications SET verified_at = consumed_at WHERE consumed_at IS NOT NULL AND verified_at IS NULL;
  END IF;
END
$$;

UPDATE otp_verifications SET status = 'verified' WHERE verified_at IS NOT NULL AND status = 'pending';

ALTER TABLE otp_verifications DROP CONSTRAINT IF EXISTS otp_verifications_purpose_check;
UPDATE otp_verifications SET purpose = 'forgot_password' WHERE purpose = 'password_reset';
ALTER TABLE otp_verifications ADD CONSTRAINT otp_verifications_purpose_check
  CHECK (purpose IN ('signup', 'login', 'forgot_password', 'phone_verification', 'email_verification'));

ALTER TABLE otp_verifications DROP CONSTRAINT IF EXISTS otp_verifications_status_check;
ALTER TABLE otp_verifications ADD CONSTRAINT otp_verifications_status_check
  CHECK (status IN ('pending', 'verified', 'expired', 'invalidated'));

ALTER TABLE otp_verifications ALTER COLUMN identifier SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'otp_verifications_user_id_fkey'
  ) THEN
    ALTER TABLE otp_verifications
      ADD CONSTRAINT otp_verifications_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE;
  END IF;
END
$$;

DROP TRIGGER IF EXISTS otp_verifications_set_updated_at ON otp_verifications;
DROP INDEX IF EXISTS otp_verifications_phone_purpose_idx;
ALTER TABLE otp_verifications DROP COLUMN IF EXISTS phone;
ALTER TABLE otp_verifications DROP COLUMN IF EXISTS consumed_at;
ALTER TABLE otp_verifications DROP COLUMN IF EXISTS cooldown_until;
ALTER TABLE otp_verifications DROP COLUMN IF EXISTS ip_address;
ALTER TABLE otp_verifications DROP COLUMN IF EXISTS user_agent;
ALTER TABLE otp_verifications DROP COLUMN IF EXISTS updated_at;

CREATE INDEX IF NOT EXISTS otp_verifications_user_id_idx ON otp_verifications (user_id);
CREATE INDEX IF NOT EXISTS otp_verifications_identifier_idx ON otp_verifications (identifier, purpose, created_at DESC);

ALTER TABLE IF EXISTS refresh_sessions RENAME TO sessions;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sessions' AND column_name = 'token_hash'
  ) THEN
    ALTER TABLE sessions RENAME COLUMN token_hash TO refresh_token_hash;
  END IF;
END
$$;

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS device_id VARCHAR(128);
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS device_name VARCHAR(120);

DROP TRIGGER IF EXISTS refresh_sessions_set_updated_at ON sessions;
DROP INDEX IF EXISTS refresh_sessions_family_id_idx;
ALTER TABLE sessions DROP COLUMN IF EXISTS family_id;
ALTER TABLE sessions DROP COLUMN IF EXISTS revoke_reason;
ALTER TABLE sessions DROP COLUMN IF EXISTS replaced_by_id;
ALTER TABLE sessions DROP COLUMN IF EXISTS updated_at;

ALTER TABLE sessions DROP CONSTRAINT IF EXISTS refresh_sessions_token_hash_unique;
ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_refresh_token_hash_unique;
ALTER TABLE sessions ADD CONSTRAINT sessions_refresh_token_hash_unique UNIQUE (refresh_token_hash);

DROP INDEX IF EXISTS refresh_sessions_user_id_idx;
DROP INDEX IF EXISTS refresh_sessions_expires_at_idx;
DROP INDEX IF EXISTS refresh_sessions_active_user_idx;
CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions (user_id);
CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions (expires_at);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'api_keys' AND column_name = 'name'
  ) THEN
    ALTER TABLE api_keys RENAME COLUMN name TO key_name;
  END IF;
END
$$;

DROP TRIGGER IF EXISTS api_keys_set_updated_at ON api_keys;
ALTER TABLE api_keys DROP COLUMN IF EXISTS scopes;
ALTER TABLE api_keys DROP COLUMN IF EXISTS revoke_reason;
ALTER TABLE api_keys DROP COLUMN IF EXISTS updated_at;

DROP INDEX IF EXISTS api_keys_prefix_idx;
CREATE INDEX IF NOT EXISTS api_keys_key_hash_idx ON api_keys (key_hash);

ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS company_id UUID;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS site_id UUID;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS description TEXT;

UPDATE audit_logs
SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{requestId}', to_jsonb(request_id), true)
WHERE request_id IS NOT NULL AND NOT (COALESCE(metadata, '{}'::jsonb) ? 'requestId');

ALTER TABLE audit_logs DROP COLUMN IF EXISTS request_id;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'audit_logs_company_id_fkey'
  ) THEN
    ALTER TABLE audit_logs
      ADD CONSTRAINT audit_logs_company_id_fkey
      FOREIGN KEY (company_id) REFERENCES companies (id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'audit_logs_site_id_fkey'
  ) THEN
    ALTER TABLE audit_logs
      ADD CONSTRAINT audit_logs_site_id_fkey
      FOREIGN KEY (site_id) REFERENCES sites (id) ON DELETE SET NULL;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS audit_logs_company_id_idx ON audit_logs (company_id);
CREATE INDEX IF NOT EXISTS audit_logs_site_id_idx ON audit_logs (site_id);
