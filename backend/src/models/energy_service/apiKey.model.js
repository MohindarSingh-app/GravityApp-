const { pool } = require('../../config/energy_service/db');

function db(client) {
  return client || pool;
}

const COLUMNS = `
  id, user_id, company_id, key_name, key_prefix, key_hash, expires_at,
  revoked_at, last_used_at, created_at
`;

async function create(record, client) {
  const result = await db(client).query(
    `INSERT INTO api_keys (
       user_id, company_id, key_name, key_prefix, key_hash, expires_at
     )
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING ${COLUMNS}`,
    [
      record.userId,
      record.companyId || null,
      record.keyName,
      record.keyPrefix,
      record.keyHash,
      record.expiresAt || null,
    ],
  );
  return result.rows[0];
}

async function findByHash(keyHash, client) {
  const result = await db(client).query(
    `SELECT ${COLUMNS} FROM api_keys WHERE key_hash = $1`,
    [keyHash],
  );
  return result.rows[0] || null;
}

async function findByIdForUser(id, userId, client) {
  const result = await db(client).query(
    `SELECT ${COLUMNS} FROM api_keys WHERE id = $1 AND user_id = $2`,
    [id, userId],
  );
  return result.rows[0] || null;
}

async function listByUser(userId, companyId, client) {
  const result = await db(client).query(
    `SELECT ${COLUMNS}
     FROM api_keys
     WHERE user_id = $1 AND company_id IS NOT DISTINCT FROM $2
     ORDER BY created_at DESC`,
    [userId, companyId || null],
  );
  return result.rows;
}

async function revoke(id, userId, client) {
  const result = await db(client).query(
    `UPDATE api_keys
     SET revoked_at = NOW()
     WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL
     RETURNING ${COLUMNS}`,
    [id, userId],
  );
  return result.rows[0] || null;
}

async function touchLastUsed(id, client) {
  await db(client).query(
    `UPDATE api_keys
     SET last_used_at = NOW()
     WHERE id = $1 AND (last_used_at IS NULL OR last_used_at < NOW() - INTERVAL '1 minute')`,
    [id],
  );
}

module.exports = {
  create,
  findByHash,
  findByIdForUser,
  listByUser,
  revoke,
  touchLastUsed,
};
