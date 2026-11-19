const { pool } = require('../../config/energy_service/db');

function db(client) {
  return client || pool;
}

async function create(record, client) {
  const result = await db(client).query(
    `INSERT INTO otp_verifications (
       user_id, identifier, otp_code, purpose, expires_at, attempts, max_attempts, status
     )
     VALUES ($1, $2, $3, $4, $5, 0, $6, 'pending')
     RETURNING id, user_id, identifier, purpose, expires_at, attempts, max_attempts, status, created_at`,
    [
      record.userId || null,
      record.identifier,
      record.otpCode,
      record.purpose,
      record.expiresAt,
      record.maxAttempts,
    ],
  );
  return result.rows[0];
}

async function findLatest(identifier, purpose, client) {
  const result = await db(client).query(
    `SELECT id, user_id, identifier, purpose, expires_at, attempts, max_attempts,
            verified_at, status, created_at
     FROM otp_verifications
     WHERE identifier = $1 AND purpose = $2
     ORDER BY created_at DESC
     LIMIT 1`,
    [identifier, purpose],
  );
  return result.rows[0] || null;
}

async function findLatestForUpdate(identifier, purpose, client) {
  const result = await db(client).query(
    `SELECT id, user_id, identifier, otp_code, purpose, expires_at, attempts, max_attempts,
            verified_at, status, created_at
     FROM otp_verifications
     WHERE identifier = $1 AND purpose = $2
     ORDER BY created_at DESC
     LIMIT 1
     FOR UPDATE`,
    [identifier, purpose],
  );
  return result.rows[0] || null;
}

async function findPendingByCodeForUpdate(otpCode, purpose, client) {
  const result = await db(client).query(
    `SELECT id, user_id, identifier, purpose, expires_at, attempts, max_attempts, status
     FROM otp_verifications
     WHERE otp_code = $1 AND purpose = $2 AND status = 'pending'
     ORDER BY created_at DESC
     LIMIT 1
     FOR UPDATE`,
    [otpCode, purpose],
  );
  return result.rows[0] || null;
}

async function countRecentSends(identifier, purpose, since, client) {
  const result = await db(client).query(
    `SELECT COUNT(*)::int AS count
     FROM otp_verifications
     WHERE identifier = $1 AND purpose = $2 AND created_at >= $3`,
    [identifier, purpose, since],
  );
  return result.rows[0].count;
}

async function incrementAttempts(id, client) {
  const result = await db(client).query(
    `UPDATE otp_verifications
     SET attempts = attempts + 1
     WHERE id = $1
     RETURNING attempts, max_attempts`,
    [id],
  );
  return result.rows[0];
}

async function markVerified(id, client) {
  await db(client).query(
    `UPDATE otp_verifications
     SET status = 'verified', verified_at = NOW()
     WHERE id = $1`,
    [id],
  );
}

async function invalidateActive(identifier, purpose, client) {
  await db(client).query(
    `UPDATE otp_verifications
     SET status = 'invalidated'
     WHERE identifier = $1 AND purpose = $2 AND status = 'pending'`,
    [identifier, purpose],
  );
}

module.exports = {
  create,
  findLatest,
  findLatestForUpdate,
  findPendingByCodeForUpdate,
  countRecentSends,
  incrementAttempts,
  markVerified,
  invalidateActive,
};
