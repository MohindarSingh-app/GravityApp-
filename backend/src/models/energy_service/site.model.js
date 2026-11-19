const { pool } = require('../../config/energy_service/db');

function db(client) {
  return client || pool;
}

const COLUMNS = `
  id, company_id, site_name, site_type, address, city, state, country, pincode,
  latitude, longitude, is_primary, status, created_at, updated_at
`;

async function create(record, client) {
  const result = await db(client).query(
    `INSERT INTO sites (
       company_id, site_name, site_type, address, city, state, country, pincode,
       latitude, longitude, is_primary, status
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING ${COLUMNS}`,
    [
      record.companyId,
      record.siteName,
      record.siteType,
      record.address,
      record.city,
      record.state || null,
      record.country || 'India',
      record.pincode || null,
      record.latitude,
      record.longitude,
      record.isPrimary,
      record.status || 'active',
    ],
  );
  return result.rows[0];
}

async function findById(id, client) {
  const result = await db(client).query(
    `SELECT ${COLUMNS} FROM sites WHERE id = $1`,
    [id],
  );
  return result.rows[0] || null;
}

async function listByCompany(companyId, client) {
  const result = await db(client).query(
    `SELECT ${COLUMNS}
     FROM sites
     WHERE company_id = $1
     ORDER BY is_primary DESC, created_at ASC`,
    [companyId],
  );
  return result.rows;
}

async function countByCompany(companyId, client) {
  const result = await db(client).query(
    `SELECT COUNT(*)::int AS count FROM sites WHERE company_id = $1 AND status = 'active'`,
    [companyId],
  );
  return result.rows[0].count;
}

async function copyByCompany(sourceCompanyId, targetCompanyId, client) {
  const result = await db(client).query(
    `INSERT INTO sites (
       company_id, site_name, site_type, address, city, state, country, pincode,
       latitude, longitude, is_primary, status
     )
     SELECT $2, site_name, site_type, address, city, state, country, pincode,
            latitude, longitude, is_primary, status
     FROM sites
     WHERE company_id = $1
     RETURNING id`,
    [sourceCompanyId, targetCompanyId],
  );
  return result.rowCount;
}

async function clearPrimary(companyId, exceptId, client) {
  await db(client).query(
    `UPDATE sites
     SET is_primary = FALSE
     WHERE company_id = $1 AND is_primary = TRUE AND id IS DISTINCT FROM $2`,
    [companyId, exceptId || null],
  );
}

async function update(id, fields, client) {
  const result = await db(client).query(
    `UPDATE sites
     SET site_name = COALESCE($2, site_name),
         site_type = COALESCE($3, site_type),
         address = COALESCE($4, address),
         city = COALESCE($5, city),
         state = COALESCE($6, state),
         country = COALESCE($7, country),
         pincode = COALESCE($8, pincode),
         latitude = COALESCE($9, latitude),
         longitude = COALESCE($10, longitude),
         is_primary = COALESCE($11, is_primary),
         status = COALESCE($12, status)
     WHERE id = $1
     RETURNING ${COLUMNS}`,
    [
      id,
      fields.siteName,
      fields.siteType,
      fields.address,
      fields.city,
      fields.state,
      fields.country,
      fields.pincode,
      fields.latitude,
      fields.longitude,
      fields.isPrimary,
      fields.status,
    ],
  );
  return result.rows[0] || null;
}

async function remove(id, client) {
  const result = await db(client).query(
    `DELETE FROM sites WHERE id = $1 RETURNING ${COLUMNS}`,
    [id],
  );
  return result.rows[0] || null;
}

module.exports = {
  create,
  findById,
  listByCompany,
  countByCompany,
  copyByCompany,
  clearPrimary,
  update,
  remove,
};
