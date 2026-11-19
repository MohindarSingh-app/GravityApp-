-- Rollback for migrations/005_restore_users_table.sql.
-- User rows are never deleted by rollback; restore data before removing this table.

DO $$
DECLARE
  users_table_created BOOLEAN;
BEGIN
  users_table_created := COALESCE(
    obj_description('public.users'::regclass, 'pg_class') = 'created by migration 005_restore_users_table.sql',
    FALSE
  );

  IF users_table_created AND EXISTS (SELECT 1 FROM public.users LIMIT 1) THEN
    RAISE EXCEPTION 'Cannot rollback 005: users contains data; preserve or migrate those rows first';
  END IF;

  IF users_table_created THEN
    IF EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'public.sessions'::regclass
        AND conname = 'sessions_user_id_restore_fkey'
        AND obj_description(oid, 'pg_constraint') = 'created by migration 005_restore_users_table.sql'
    ) THEN
      ALTER TABLE public.sessions DROP CONSTRAINT sessions_user_id_restore_fkey;
    END IF;

    IF EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'public.api_keys'::regclass
        AND conname = 'api_keys_user_id_restore_fkey'
        AND obj_description(oid, 'pg_constraint') = 'created by migration 005_restore_users_table.sql'
    ) THEN
      ALTER TABLE public.api_keys DROP CONSTRAINT api_keys_user_id_restore_fkey;
    END IF;

    IF EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'public.audit_logs'::regclass
        AND conname = 'audit_logs_user_id_restore_fkey'
        AND obj_description(oid, 'pg_constraint') = 'created by migration 005_restore_users_table.sql'
    ) THEN
      ALTER TABLE public.audit_logs DROP CONSTRAINT audit_logs_user_id_restore_fkey;
    END IF;

    IF EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgrelid = 'public.users'::regclass
        AND tgname = 'users_set_updated_at'
        AND obj_description(oid, 'pg_trigger') = 'created by migration 005_restore_users_table.sql'
    ) THEN
      DROP TRIGGER users_set_updated_at ON public.users;
    END IF;

    DROP TABLE public.users;
  END IF;
END
$$;

DELETE FROM schema_migrations WHERE id = '005_restore_users_table.sql';