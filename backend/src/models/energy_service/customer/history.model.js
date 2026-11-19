const { db } = require('./query');

const RETURNED = `
  id, old_status, new_status, changed_by, changed_at, remarks
`;

async function insert(record, client) {
  if (record.entityType === 'repair_ticket') {
    const result = await db(client).query(
      `INSERT INTO repair_status_history (
         repair_ticket_id, old_status, new_status, changed_by, remarks
       )
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, old_status, new_status, changed_by, created_at AS changed_at, remarks`,
      [record.entityId, record.fromStatus || null, record.toStatus, record.actorId || null, record.note || null],
    );
    return result.rows[0];
  }

  if (record.entityType === 'service_request') {
    const result = await db(client).query(
      `INSERT INTO service_request_status_history (
         service_request_id, old_status, new_status, changed_by, remarks, changed_at
       )
       VALUES ($1, $2, $3, $4, $5, clock_timestamp())
       RETURNING ${RETURNED}`,
      [record.entityId, record.fromStatus || null, record.toStatus, record.actorId || null, record.note || null],
    );
    return result.rows[0];
  }

  if (record.entityType === 'project_request') {
    const result = await db(client).query(
      `INSERT INTO project_status_history (
         project_request_id, old_status, new_status, changed_by, remarks
       )
       VALUES ($1, $2, $3, $4, $5)
       RETURNING ${RETURNED}`,
      [record.entityId, record.fromStatus || null, record.toStatus, record.actorId || null, record.note || null],
    );
    return result.rows[0];
  }

  const column = {
    amc_request: 'amc_request_id',
    amc_contract: 'amc_contract_id',
    amc_reschedule: 'amc_reschedule_id',
  }[record.entityType];
  if (!column) {
    throw new Error('Unknown status history target.');
  }
  const result = await db(client).query(
    `INSERT INTO amc_status_history (
       company_id, ${column}, old_status, new_status, changed_by, remarks
     )
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING ${RETURNED}`,
    [
      record.companyId,
      record.entityId,
      record.fromStatus || null,
      record.toStatus,
      record.actorId || null,
      record.note || null,
    ],
  );
  return result.rows[0];
}

async function list(companyId, entityType, entityId, client) {
  if (entityType === 'repair_ticket') {
    const result = await db(client).query(
      `SELECT id, old_status, new_status, changed_by, created_at AS changed_at, remarks
       FROM repair_status_history
       WHERE repair_ticket_id = $1
       ORDER BY created_at ASC
       LIMIT 100`,
      [entityId],
    );
    return result.rows;
  }
  if (entityType === 'service_request') {
    const result = await db(client).query(
      `SELECT ${RETURNED}
       FROM service_request_status_history
       WHERE service_request_id = $1
       ORDER BY changed_at ASC, id ASC
       LIMIT 100`,
      [entityId],
    );
    return result.rows;
  }
  if (entityType === 'project_request') {
    const result = await db(client).query(
      `SELECT ${RETURNED}
       FROM project_status_history
       WHERE project_request_id = $1
       ORDER BY changed_at ASC
       LIMIT 100`,
      [entityId],
    );
    return result.rows;
  }
  const column = {
    amc_request: 'amc_request_id',
    amc_contract: 'amc_contract_id',
    amc_reschedule: 'amc_reschedule_id',
  }[entityType];
  const result = await db(client).query(
    `SELECT ${RETURNED}
     FROM amc_status_history
     WHERE company_id = $1 AND ${column} = $2
     ORDER BY changed_at ASC
     LIMIT 100`,
    [companyId, entityId],
  );
  return result.rows;
}

module.exports = { insert, list };
