-- Align persisted roles with the fixed product role vocabulary.
-- Role IDs are unchanged, so existing role_id references remain valid.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM roles
    WHERE name NOT IN (
      'owner', 'admin', 'manager', 'user',
      'DIRECTOR_OWNER', 'MAINTENANCE_HEAD', 'PURCHASE_MGR', 'SITE_ENGINEER'
    )
  ) THEN
    RAISE EXCEPTION 'Unexpected role names exist; review them before applying 004_exact_role_names.sql';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM roles AS old_role
    JOIN roles AS new_role
      ON new_role.name = CASE old_role.name
        WHEN 'owner' THEN 'DIRECTOR_OWNER'
        WHEN 'admin' THEN 'MAINTENANCE_HEAD'
        WHEN 'manager' THEN 'PURCHASE_MGR'
        WHEN 'user' THEN 'SITE_ENGINEER'
      END
    WHERE old_role.name IN ('owner', 'admin', 'manager', 'user')
  ) THEN
    RAISE EXCEPTION 'Both legacy and target role rows exist; reconcile role IDs before migration';
  END IF;
END
$$;

UPDATE roles
SET name = CASE name
  WHEN 'owner' THEN 'DIRECTOR_OWNER'
  WHEN 'admin' THEN 'MAINTENANCE_HEAD'
  WHEN 'manager' THEN 'PURCHASE_MGR'
  WHEN 'user' THEN 'SITE_ENGINEER'
  ELSE name
END,
description = CASE name
  WHEN 'owner' THEN 'Creates the company and manages people, sites, and keys.'
  WHEN 'admin' THEN 'Runs sites, people, and API keys for the company.'
  WHEN 'manager' THEN 'Reads the company and creates or updates sites.'
  WHEN 'user' THEN 'Reads company records and updates their own profile.'
  ELSE description
END
WHERE name IN ('owner', 'admin', 'manager', 'user');

ALTER TABLE roles
  ADD CONSTRAINT roles_name_check
  CHECK (name IN ('DIRECTOR_OWNER', 'MAINTENANCE_HEAD', 'PURCHASE_MGR', 'SITE_ENGINEER'));