const { pool } = require('../../config/energy_service/db');

async function create({ userId, companyId, subject, message }) {
  const result = await pool.query(
    `INSERT INTO support_requests (user_id, company_id, subject, message)
     VALUES ($1, $2, $3, $4)
     RETURNING id, subject, message, status, created_at`,
    [userId, companyId || null, subject, message],
  );
  return result.rows[0];
}

module.exports = { create };
