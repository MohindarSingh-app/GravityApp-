-- GSTIN uniqueness is enforced by application/workspace rules, not as a
-- global database constraint: an owner may copy their company into a separate
-- workspace while retaining the GSTIN.

DROP INDEX IF EXISTS companies_gst_number_unique;
