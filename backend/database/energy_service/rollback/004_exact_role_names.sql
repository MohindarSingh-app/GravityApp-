-- Rollback for migrations/004_exact_role_names.sql.
-- Run only after application code has been rolled back to legacy role names.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM roles
    WHERE name NOT IN (
      'DIRECTOR_OWNER', 'MAINTENANCE_HEAD', 'PURCHASE_MGR', 'SITE_ENGINEER',
      'owner', 'admin', 'manager', 'user'
    )
  ) THEN
    RAISE EXCEPTION 'Unexpected role names exist; review them before rolling back 004_exact_role_names.sql';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM roles AS new_role
    JOIN roles AS old_role
      ON old_role.name = CASE new_role.name
        WHEN 'DIRECTOR_OWNER' THEN 'owner'
        WHEN 'MAINTENANCE_HEAD' THEN 'admin'
        WHEN 'PURCHASE_MGR' THEN 'manager'
        WHEN 'SITE_ENGINEER' THEN 'user'
      END
    WHERE new_role.name IN ('DIRECTOR_OWNER', 'MAINTENANCE_HEAD', 'PURCHASE_MGR', 'SITE_ENGINEER')
  ) THEN
    RAISE EXCEPTION 'Both target and legacy role rows exist; reconcile role IDs before rollback';
  END IF;
END
$$;

ALTER TABLE roles DROP CONSTRAINT roles_name_check;

UPDATE roles
SET name = CASE name
  WHEN 'DIRECTOR_OWNER' THEN 'owner'
  WHEN 'MAINTENANCE_HEAD' THEN 'admin'
  WHEN 'PURCHASE_MGR' THEN 'manager'
  WHEN 'SITE_ENGINEER' THEN 'user'
  ELSE name
END,
description = CASE name
  WHEN 'DIRECTOR_OWNER' THEN 'Company owner with full access'
  WHEN 'MAINTENANCE_HEAD' THEN 'Company administrator'
  WHEN 'PURCHASE_MGR' THEN 'Site and operations manager'
  WHEN 'SITE_ENGINEER' THEN 'Standard company user'
  ELSE description
END
WHERE name IN ('DIRECTOR_OWNER', 'MAINTENANCE_HEAD', 'PURCHASE_MGR', 'SITE_ENGINEER');

DELETE FROM schema_migrations WHERE id = '004_exact_role_names.sql';