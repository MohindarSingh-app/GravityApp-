const { db } = require('./query');

async function findByUserAndCompany(userId, companyId, client) {
  const result = await db(client).query(
    `SELECT id, user_id, company_id, created_at, updated_at
     FROM customers
     WHERE user_id = $1 AND company_id = $2`,
    [userId, companyId],
  );
  return result.rows[0] || null;
}

async function findById(id, client) {
  const result = await db(client).query(
    `SELECT id, user_id, company_id, created_at, updated_at
     FROM customers
     WHERE id = $1`,
    [id],
  );
  return result.rows[0] || null;
}

async function insert(record, client) {
  const result = await db(client).query(
    `INSERT INTO customers (user_id, company_id)
     VALUES ($1, $2)
     ON CONFLICT (company_id, user_id)
     DO UPDATE SET updated_at = NOW()
     RETURNING id, user_id, company_id, created_at, updated_at`,
    [record.userId, record.companyId],
  );
  return result.rows[0];
}

module.exports = { findByUserAndCompany, findById, insert };
