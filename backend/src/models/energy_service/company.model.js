const { pool } = require('../../config/energy_service/db');

function db(client) {
  return client || pool;
}

const COLUMNS = `
  id, company_name, legal_name, gst_number, industry, city, state, country,
  pincode, address, status, created_at, updated_at
`;

async function create(record, client) {
  const result = await db(client).query(
    `INSERT INTO companies (
       company_name, legal_name, gst_number, industry, city, state, country,
       pincode, address, status, owner_user_id
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING ${COLUMNS}`,
    [
      record.companyName,
      record.legalName || null,
      record.gstNumber,
      record.industry,
      record.city,
      record.state || null,
      record.country || 'India',
      record.pincode || null,
      record.address || null,
      record.status || 'active',
      record.ownerUserId || null,
    ],
  );
  return result.rows[0];
}

async function findById(id, client) {
  const result = await db(client).query(
    `SELECT ${COLUMNS} FROM companies WHERE id = $1`,
    [id],
  );
  return result.rows[0] || null;
}

async function listByGstNumber(gstNumber, client) {
  const result = await db(client).query(
    `SELECT ${COLUMNS} FROM companies WHERE gst_number = $1 ORDER BY created_at ASC`,
    [gstNumber],
  );
  return result.rows;
}

async function listByUser(userId, client) {
  const result = await db(client).query(
    `SELECT c.id, c.company_name, c.legal_name, c.gst_number, c.industry, c.city,
            c.state, c.country, c.pincode, c.address, c.status, c.created_at, c.updated_at
     FROM companies c
     JOIN company_members cm ON cm.company_id = c.id
     WHERE cm.user_id = $1
     ORDER BY (c.id = (SELECT company_id FROM users WHERE id = $1)) DESC, cm.created_at ASC`,
    [userId],
  );
  return result.rows;
}

async function update(id, fields, client) {
  const result = await db(client).query(
    `UPDATE companies
     SET company_name = COALESCE($2, company_name),
         legal_name = COALESCE($3, legal_name),
         gst_number = COALESCE($4, gst_number),
         industry = COALESCE($5, industry),
         city = COALESCE($6, city),
         state = COALESCE($7, state),
         country = COALESCE($8, country),
         pincode = COALESCE($9, pincode),
         address = COALESCE($10, address),
         status = COALESCE($11, status)
     WHERE id = $1
     RETURNING ${COLUMNS}`,
    [
      id,
      fields.companyName,
      fields.legalName,
      fields.gstNumber,
      fields.industry,
      fields.city,
      fields.state,
      fields.country,
      fields.pincode,
      fields.address,
      fields.status,
    ],
  );
  return result.rows[0] || null;
}

module.exports = {
  create,
  findById,
  listByGstNumber,
  listByUser,
  update,
};
