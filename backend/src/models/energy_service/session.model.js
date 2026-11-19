const { pool } = require('../../config/energy_service/db');

function db(client) {
  return client || pool;
}

async function insert(session, client) {
  await db(client).query(
    `INSERT INTO sessions (
       id, user_id, refresh_token_hash, device_id, device_name,
       expires_at, user_agent, ip_address, last_used_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
    [
      session.id,
      session.userId,
      session.tokenHash,
      session.deviceId || null,
      session.deviceName || null,
      session.expiresAt,
      session.userAgent,
      session.ip,
    ],
  );
}

async function findById(id, client) {
  const result = await db(client).query(
    `SELECT id, user_id, device_id, device_name, expires_at, revoked_at,
            user_agent, ip_address, last_used_at, created_at
     FROM sessions
     WHERE id = $1`,
    [id],
  );
  return result.rows[0] || null;
}

async function findByHashForUpdate(tokenHash, client) {
  const result = await db(client).query(
    `SELECT id, user_id, expires_at, revoked_at, revoke_reason
     FROM sessions
     WHERE refresh_token_hash = $1
     FOR UPDATE`,
    [tokenHash],
  );
  return result.rows[0] || null;
}

async function listByUser(userId, client) {
  const result = await db(client).query(
    `SELECT id, device_id, device_name, user_agent, ip_address, last_used_at,
            expires_at, revoked_at, created_at
     FROM sessions
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 50`,
    [userId],
  );
  return result.rows;
}

async function revokeByHash(tokenHash, client) {
  const result = await db(client).query(
    `UPDATE sessions
     SET revoked_at = NOW(), revoke_reason = COALESCE(revoke_reason, 'logout')
     WHERE refresh_token_hash = $1 AND revoked_at IS NULL`,
    [tokenHash],
  );
  return result.rowCount;
}

async function revokeById(userId, sessionId, client) {
  const result = await db(client).query(
    `UPDATE sessions
     SET revoked_at = NOW(), revoke_reason = COALESCE(revoke_reason, 'revoked')
     WHERE id = $2 AND user_id = $1 AND revoked_at IS NULL
     RETURNING id`,
    [userId, sessionId],
  );
  return result.rows[0] || null;
}

async function revokeAllForUser(userId, client, reason = 'revoked') {
  await db(client).query(
    `UPDATE sessions
     SET revoked_at = NOW(), revoke_reason = COALESCE(revoke_reason, $2)
     WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId, reason],
  );
}

async function revokeAllExcept(userId, sessionId, client) {
  await db(client).query(
    `UPDATE sessions
     SET revoked_at = NOW(), revoke_reason = COALESCE(revoke_reason, 'password_change')
     WHERE user_id = $1 AND id <> $2 AND revoked_at IS NULL`,
    [userId, sessionId],
  );
}

async function markRevoked(id, client, reason = 'rotated') {
  await db(client).query(
    `UPDATE sessions
     SET revoked_at = COALESCE(revoked_at, NOW()),
         revoke_reason = COALESCE(revoke_reason, $2)
     WHERE id = $1`,
    [id, reason],
  );
}

async function touchLastUsed(id, client) {
  await db(client).query(
    `UPDATE sessions
     SET last_used_at = NOW()
     WHERE id = $1 AND (last_used_at IS NULL OR last_used_at < NOW() - INTERVAL '1 minute')`,
    [id],
  );
}

module.exports = {
  insert,
  findById,
  findByHashForUpdate,
  listByUser,
  revokeByHash,
  revokeById,
  revokeAllForUser,
  revokeAllExcept,
  markRevoked,
  touchLastUsed,
};
