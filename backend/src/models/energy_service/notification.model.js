const { pool } = require('../../config/energy_service/db');

function db(client) {
  return client || pool;
}

async function listForUser(userId, companyId, client) {
  const result = await db(client).query(
    `SELECT al.id, al.action, al.description, al.entity_type, al.entity_id,
            al.metadata, al.created_at, nr.read_at
     FROM audit_logs al
     LEFT JOIN notification_reads nr
       ON nr.audit_log_id = al.id AND nr.user_id = $1
     WHERE (al.user_id = $1 OR ($2::uuid IS NOT NULL AND al.company_id = $2))
       AND al.action NOT IN ('auth.login', 'auth.login_failed', 'auth.register')
     ORDER BY al.created_at DESC
     LIMIT 50`,
    [userId, companyId || null],
  );
  return result.rows;
}

async function markRead(userId, notificationId, companyId, client) {
  const result = await db(client).query(
    `INSERT INTO notification_reads (user_id, audit_log_id)
     SELECT $1, al.id
     FROM audit_logs al
     WHERE al.id = $2
       AND (al.user_id = $1 OR ($3::uuid IS NOT NULL AND al.company_id = $3))
       AND al.action NOT IN ('auth.login', 'auth.login_failed', 'auth.register')
     ON CONFLICT (user_id, audit_log_id)
     DO UPDATE SET read_at = notification_reads.read_at
     RETURNING audit_log_id, read_at`,
    [userId, notificationId, companyId || null],
  );
  return result.rows[0] || null;
}

module.exports = { listForUser, markRead };
