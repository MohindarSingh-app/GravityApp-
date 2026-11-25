const { pool } = require('../../config/energy_service/db');

const SIGNAL_COLUMNS = `
  s.id, s.company_id, s.site_id, s.job_id, s.device_id, s.kind, s.title, s.detail,
  s.status, s.eta_minutes, s.actor_name, s.issues_found, s.error_code, s.risk_note,
  s.scope_costs, s.created_at,
  j.code AS job_code, j.title AS job_title, j.created_at AS job_created_at,
  j.engineer_name AS job_engineer_name, j.engineer_trade AS job_engineer_trade,
  j.rating AS job_engineer_rating,
  d.site_id AS device_site_id,
  d.device_type, d.manufacturer, d.model, d.serial_number, d.power_rating,
  d.location AS installation_location
`;

function db(client) {
  return client || pool;
}

async function listCatalog(client) {
  const result = await db(client).query(
    `SELECT id, code, name, category, summary, same_day
     FROM service_catalog
     WHERE active = TRUE
     ORDER BY name ASC`,
  );
  return result.rows;
}

async function listSpares(client) {
  const result = await db(client).query(
    `SELECT id, sku, name, summary
     FROM spare_catalog
     WHERE active = TRUE
     ORDER BY name ASC`,
  );
  return result.rows;
}

async function listJobs(companyId, client) {
  const result = await db(client).query(
    `SELECT id, company_id, site_id, code, title, category, priority, status,
            location_label, engineer_name, engineer_trade, rating, estimate_amount,
            sla_due_at, eta_minutes, notes, marketplace_published, created_at, updated_at
     FROM field_jobs
     WHERE company_id = $1
     ORDER BY created_at DESC
     LIMIT 40`,
    [companyId],
  );
  return result.rows;
}

async function findJob(id, companyId, client) {
  const result = await db(client).query(
    `SELECT id, company_id, site_id, code, title, category, priority, status,
            location_label, engineer_name, engineer_trade, rating, estimate_amount,
            sla_due_at, eta_minutes, notes, marketplace_published, created_at
     FROM field_jobs
     WHERE id = $1 AND company_id = $2`,
    [id, companyId],
  );
  return result.rows[0] || null;
}

async function insertJob(record, client) {
  const result = await db(client).query(
    `INSERT INTO field_jobs (
       company_id, site_id, code, title, category, priority, status,
       location_label, sla_due_at, eta_minutes, notes, marketplace_published
     )
     VALUES ($1, $2, $3, $4, $5, $6, 'open', $7, $8, $9, $10, $11)
     RETURNING id, company_id, site_id, code, title, category, priority, status,
               location_label, engineer_name, engineer_trade, rating, estimate_amount,
               sla_due_at, eta_minutes, notes, marketplace_published, created_at`,
    [
      record.companyId,
      record.siteId || null,
      record.code,
      record.title,
      record.category,
      record.priority,
      record.locationLabel || null,
      record.slaDueAt,
      record.etaMinutes || null,
      record.notes || null,
      record.marketplacePublished || false,
    ],
  );
  return result.rows[0];
}

async function updateJobStatus(id, companyId, status, etaMinutes, client) {
  const result = await db(client).query(
    `UPDATE field_jobs
     SET status = $3,
         eta_minutes = COALESCE($4, eta_minutes)
     WHERE id = $1 AND company_id = $2
     RETURNING id, company_id, site_id, code, title, category, priority, status,
               location_label, engineer_name, engineer_trade, rating, estimate_amount,
               sla_due_at, eta_minutes, notes, marketplace_published, created_at`,
    [id, companyId, status, etaMinutes || null],
  );
  return result.rows[0] || null;
}

async function countJobs(companyId, client) {
  const result = await db(client).query(
    `SELECT
       COUNT(*) FILTER (WHERE status IN ('open', 'on_the_way', 'in_progress'))::int AS active,
       COUNT(*) FILTER (
         WHERE status IN ('open', 'on_the_way', 'in_progress')
           AND (priority = 'emergency' OR (sla_due_at IS NOT NULL AND sla_due_at < NOW() + INTERVAL '30 minutes'))
       )::int AS sla_risk
     FROM field_jobs
     WHERE company_id = $1`,
    [companyId],
  );
  return result.rows[0];
}

async function listSignals(companyId, kind, client) {
  const params = [companyId];
  let filter = '';
  if (kind) {
    params.push(kind);
    filter = ` AND s.kind = $${params.length}`;
  }
  const result = await db(client).query(
    `SELECT ${SIGNAL_COLUMNS}
     FROM field_signals s
     LEFT JOIN field_jobs j ON j.id = s.job_id AND j.company_id = s.company_id
     LEFT JOIN devices d ON d.id = s.device_id AND d.company_id = s.company_id
     WHERE s.company_id = $1${filter}
     ORDER BY s.created_at DESC
     LIMIT 30`,
    params,
  );
  return result.rows;
}

async function latestOpenSignal(companyId, kind, client) {
  const result = await db(client).query(
    `SELECT ${SIGNAL_COLUMNS}
     FROM field_signals s
     LEFT JOIN field_jobs j ON j.id = s.job_id AND j.company_id = s.company_id
     LEFT JOIN devices d ON d.id = s.device_id AND d.company_id = s.company_id
     WHERE s.company_id = $1 AND s.kind = $2 AND s.status = 'open'
     ORDER BY s.created_at DESC
     LIMIT 1`,
    [companyId, kind],
  );
  return result.rows[0] || null;
}

async function latestOpenSignals(companyId, kinds, client) {
  if (!kinds.length) return {};
  const result = await db(client).query(
    `SELECT DISTINCT ON (s.kind) ${SIGNAL_COLUMNS}
     FROM field_signals s
     LEFT JOIN field_jobs j ON j.id = s.job_id AND j.company_id = s.company_id
     LEFT JOIN devices d ON d.id = s.device_id AND d.company_id = s.company_id
     WHERE s.company_id = $1 AND s.kind::text = ANY($2::text[]) AND s.status = 'open'
     ORDER BY s.kind, s.created_at DESC`,
    [companyId, kinds],
  );
  return result.rows.reduce((signals, row) => {
    signals[row.kind] = row;
    return signals;
  }, {});
}

async function findSignal(id, companyId, client) {
  const result = await db(client).query(
    `SELECT ${SIGNAL_COLUMNS}
     FROM field_signals s
     LEFT JOIN field_jobs j ON j.id = s.job_id AND j.company_id = s.company_id
     LEFT JOIN devices d ON d.id = s.device_id AND d.company_id = s.company_id
     WHERE s.id = $1 AND s.company_id = $2`,
    [id, companyId],
  );
  return result.rows[0] || null;
}

async function insertSignal(record, client) {
  const result = await db(client).query(
    `INSERT INTO field_signals (
       company_id, site_id, job_id, device_id, kind, title, detail, issues_found,
       error_code, risk_note, scope_costs, eta_minutes, actor_name
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     RETURNING id, company_id, job_id, site_id, device_id, kind, title, detail, status,
               eta_minutes, actor_name, issues_found, error_code, risk_note, scope_costs, created_at`,
    [
      record.companyId,
      record.siteId || null,
      record.jobId || null,
      record.deviceId || null,
      record.kind,
      record.title,
      record.detail,
      JSON.stringify(record.issuesFound || []),
      record.errorCode || null,
      record.riskNote || null,
      JSON.stringify(record.scopeCosts || {}),
      record.etaMinutes || null,
      record.actorName || null,
    ],
  );
  return result.rows[0];
}

async function closeTransit(companyId, client) {
  await db(client).query(
    `UPDATE field_signals
     SET status = 'closed'
     WHERE company_id = $1 AND kind = 'transit' AND status = 'open'`,
    [companyId],
  );
}

async function listAmc(companyId, client) {
  const result = await db(client).query(
    `SELECT id, title, status, discount_percent, quote_hours, coverage,
            priority_response, created_at
     FROM amc_plans
     WHERE company_id = $1
     ORDER BY created_at DESC
     LIMIT 20`,
    [companyId],
  );
  return result.rows;
}

async function insertAmc(record, client) {
  const result = await db(client).query(
    `INSERT INTO amc_plans (company_id, site_id, title, coverage, discount_percent, quote_hours)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, title, status, discount_percent, quote_hours, coverage, priority_response, created_at`,
    [
      record.companyId,
      record.siteId || null,
      record.title,
      record.coverage,
      record.discountPercent || null,
      record.quoteHours || 48,
    ],
  );
  return result.rows[0];
}

async function listCerts(companyId, client) {
  const result = await db(client).query(
    `SELECT id, name, expires_at, created_at
     FROM compliance_certs
     WHERE company_id = $1
     ORDER BY expires_at ASC
     LIMIT 30`,
    [companyId],
  );
  return result.rows;
}

async function insertCert(record, client) {
  const result = await db(client).query(
    `INSERT INTO compliance_certs (company_id, site_id, name, expires_at)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, expires_at, created_at`,
    [record.companyId, record.siteId || null, record.name, record.expiresAt],
  );
  return result.rows[0];
}

module.exports = {
  listCatalog,
  listSpares,
  listJobs,
  findJob,
  insertJob,
  updateJobStatus,
  countJobs,
  listSignals,
  latestOpenSignal,
  latestOpenSignals,
  findSignal,
  insertSignal,
  closeTransit,
  listAmc,
  insertAmc,
  listCerts,
  insertCert,
};
