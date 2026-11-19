const { pool } = require('../../config/energy_service/db');
const { redact } = require('../../utils/energy_service/logger');

function db(client) {
  return client || pool;
}

async function create(record, client) {
  await db(client).query(
    `INSERT INTO audit_logs (
       user_id, company_id, site_id, action, entity_type, entity_id,
       description, ip_address, user_agent, metadata
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)`,
    [
      record.userId || null,
      record.companyId || null,
      record.siteId || null,
      record.action,
      record.entityType || null,
      record.entityId || null,
      record.description || null,
      record.ip || null,
      record.userAgent || null,
      JSON.stringify(redact(record.metadata || {}, 0)),
    ],
  );
}

async function countRecentFailures(userId, withinMinutes, client) {
  const result = await db(client).query(
    `SELECT COUNT(*)::int AS count
     FROM audit_logs
     WHERE user_id = $1
       AND action = 'auth.login_failed'
       AND created_at > NOW() - ($2 * INTERVAL '1 minute')
       AND created_at > COALESCE(
         (SELECT MAX(created_at) FROM audit_logs WHERE user_id = $1 AND action = 'auth.login'),
         '-infinity'::timestamptz
       )`,
    [userId, withinMinutes],
  );
  return result.rows[0].count;
}

async function listRecentByCompany(companyId, actions, limit = 12, client) {
  if (!companyId || !Array.isArray(actions) || actions.length === 0) return [];
  const result = await db(client).query(
    `SELECT a.id, a.action, a.description, a.created_at, u.name AS actor_name
     FROM audit_logs a
     LEFT JOIN users u ON u.id = a.user_id
     WHERE a.company_id = $1
       AND a.action = ANY($2::varchar[])
     ORDER BY a.created_at DESC
     LIMIT $3`,
    [companyId, actions, limit],
  );
  return result.rows;
}

module.exports = { create, countRecentFailures, listRecentByCompany };
