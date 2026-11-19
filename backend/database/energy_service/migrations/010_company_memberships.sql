ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES users (id) ON DELETE SET NULL;

UPDATE companies c
SET owner_user_id = (
  SELECT u.id
  FROM users u
  JOIN roles r ON r.id = u.role_id
  WHERE u.company_id = c.id
    AND r.name = 'DIRECTOR_OWNER'
  ORDER BY u.created_at ASC
  LIMIT 1
)
WHERE c.owner_user_id IS NULL;

CREATE TABLE IF NOT EXISTS company_members (
  company_id UUID NOT NULL REFERENCES companies (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (company_id, user_id)
);

INSERT INTO company_members (company_id, user_id)
SELECT company_id, id
FROM users
WHERE company_id IS NOT NULL
ON CONFLICT (company_id, user_id) DO NOTHING;

ALTER TABLE companies DROP CONSTRAINT IF EXISTS companies_gst_number_unique;
ALTER TABLE companies DROP CONSTRAINT IF EXISTS companies_gstin_unique;
CREATE INDEX IF NOT EXISTS companies_gst_owner_idx
  ON companies (gst_number, owner_user_id)
  WHERE owner_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS company_members_user_id_idx ON company_members (user_id, created_at DESC);
