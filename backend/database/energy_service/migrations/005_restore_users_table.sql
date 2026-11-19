-- Restore the canonical users table only when it is missing.
-- Existing session/key/audit references are preserved; NOT VALID foreign keys
-- enforce new writes without scanning or rewriting historical rows.

DO $$
BEGIN
  IF to_regclass('public.users') IS NULL THEN
    CREATE TABLE public.users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id UUID REFERENCES public.companies (id) ON DELETE SET NULL,
      role_id UUID NOT NULL REFERENCES public.roles (id) ON DELETE RESTRICT,
      name VARCHAR(120),
      email VARCHAR(255),
      phone VARCHAR(20),
      password_hash TEXT,
      email_verified BOOLEAN NOT NULL DEFAULT FALSE,
      phone_verified BOOLEAN NOT NULL DEFAULT FALSE,
      status VARCHAR(20) NOT NULL DEFAULT 'active',
      last_login_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT users_email_unique UNIQUE (email),
      CONSTRAINT users_status_check CHECK (status IN ('active', 'inactive', 'suspended')),
      CONSTRAINT users_password_hash_check CHECK (password_hash IS NULL OR char_length(password_hash) > 0)
    );

    COMMENT ON TABLE public.users IS 'created by migration 005_restore_users_table.sql';
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS users_phone_unique_idx
  ON public.users (phone)
  WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS users_company_id_idx ON public.users (company_id);
CREATE INDEX IF NOT EXISTS users_role_id_idx ON public.users (role_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.users'::regclass
      AND tgname = 'users_set_updated_at'
      AND NOT tgisinternal
  ) THEN
    CREATE TRIGGER users_set_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
    COMMENT ON TRIGGER users_set_updated_at ON public.users
      IS 'created by migration 005_restore_users_table.sql';
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.sessions'::regclass
      AND contype = 'f'
      AND confrelid = 'public.users'::regclass
  ) THEN
    ALTER TABLE public.sessions
      ADD CONSTRAINT sessions_user_id_restore_fkey
      FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE CASCADE NOT VALID;
    COMMENT ON CONSTRAINT sessions_user_id_restore_fkey ON public.sessions
      IS 'created by migration 005_restore_users_table.sql';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.api_keys'::regclass
      AND contype = 'f'
      AND confrelid = 'public.users'::regclass
  ) THEN
    ALTER TABLE public.api_keys
      ADD CONSTRAINT api_keys_user_id_restore_fkey
      FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE CASCADE NOT VALID;
    COMMENT ON CONSTRAINT api_keys_user_id_restore_fkey ON public.api_keys
      IS 'created by migration 005_restore_users_table.sql';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.audit_logs'::regclass
      AND contype = 'f'
      AND confrelid = 'public.users'::regclass
  ) THEN
    ALTER TABLE public.audit_logs
      ADD CONSTRAINT audit_logs_user_id_restore_fkey
      FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE SET NULL NOT VALID;
    COMMENT ON CONSTRAINT audit_logs_user_id_restore_fkey ON public.audit_logs
      IS 'created by migration 005_restore_users_table.sql';
  END IF;
END
$$;