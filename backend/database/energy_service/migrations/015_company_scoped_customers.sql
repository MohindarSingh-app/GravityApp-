ALTER TABLE customers
  DROP CONSTRAINT IF EXISTS customers_user_unique;

ALTER TABLE customers
  ADD CONSTRAINT customers_company_user_unique UNIQUE (company_id, user_id);
