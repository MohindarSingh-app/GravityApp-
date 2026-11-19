const { db, addEq, addLike, selectPaged } = require('./query');

const CONTRACT_COLUMNS = `
  id, customer_id, company_id, site_id, contract_number, contract_type, coverage,
  start_date, end_date, visit_frequency, visits_per_year, next_visit_date,
  preferred_visit_time, status, assigned_engineer_name, assigned_service_team,
  service_contact, created_at, updated_at
`;

const REQUEST_COLUMNS = `
  id, customer_id, company_id, site_id, contract_id, request_number, request_type,
  service_requirement, preferred_date, preferred_time, description, scheduled_date,
  scheduled_time, status, submitted_at, cancelled_at, completed_at, created_at, updated_at
`;

const RESCHEDULE_COLUMNS = `
  id, amc_request_id, amc_contract_id, customer_id, company_id, previous_schedule,
  requested_schedule, requested_time, reason, notes, status, previous_request_status,
  reviewed_by, reviewed_at, review_note, created_at, updated_at
`;

function lockSql(forUpdate) {
  return forUpdate ? ' FOR UPDATE' : '';
}

async function nextContractNumber(client) {
  const result = await db(client).query(
    `SELECT 'AMC-' || to_char(NOW() AT TIME ZONE 'UTC', 'YYYY') || '-' ||
            lpad(nextval('amc_contract_number_seq')::text, 6, '0') AS contract_number`,
  );
  return result.rows[0].contract_number;
}

async function insertContract(record, client) {
  const result = await db(client).query(
    `INSERT INTO amc_contracts (
       customer_id, company_id, site_id, contract_number, contract_type, coverage,
       start_date, end_date, visit_frequency, visits_per_year, next_visit_date,
       preferred_visit_time, status, assigned_engineer_name, assigned_service_team,
       service_contact
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     RETURNING ${CONTRACT_COLUMNS}`,
    [
      record.customerId,
      record.companyId,
      record.siteId,
      record.contractNumber,
      record.amcType,
      record.coverage,
      record.startDate,
      record.endDate,
      record.visitFrequency,
      record.visitsPerYear ?? null,
      record.nextVisitDate || null,
      record.preferredVisitTime || null,
      record.status || 'active',
      record.assignedEngineerName || null,
      record.assignedServiceTeam || null,
      record.serviceContact || null,
    ],
  );
  return result.rows[0];
}

async function findContract(id, companyId, client, forUpdate = false) {
  const result = await db(client).query(
    `SELECT ${CONTRACT_COLUMNS}
     FROM amc_contracts
     WHERE id = $1 AND company_id = $2${lockSql(forUpdate)}`,
    [id, companyId],
  );
  return result.rows[0] || null;
}

async function listContracts({ companyId, status, siteId, q, limit, offset }, client) {
  const values = [];
  const where = [];
  addEq(where, values, 'company_id', companyId);
  addEq(where, values, 'status', status);
  addEq(where, values, 'site_id', siteId);
  addLike(where, values, ['contract_number', 'coverage', 'contract_type'], q);
  return selectPaged(db(client), {
    select: CONTRACT_COLUMNS,
    from: 'amc_contracts',
    where,
    values,
    order: 'created_at DESC',
    limit,
    offset,
  });
}

async function countActiveContracts(companyId, client) {
  const result = await db(client).query(
    `SELECT COUNT(*)::int AS active
     FROM amc_contracts
     WHERE company_id = $1 AND status = 'active'`,
    [companyId],
  );
  return result.rows[0].active;
}

async function updateContract(id, companyId, fields, client) {
  const result = await db(client).query(
    `UPDATE amc_contracts
     SET contract_type = COALESCE($3, contract_type),
         coverage = COALESCE($4, coverage),
         start_date = COALESCE($5, start_date),
         end_date = COALESCE($6, end_date),
         visit_frequency = COALESCE($7, visit_frequency),
         visits_per_year = COALESCE($8, visits_per_year),
         next_visit_date = COALESCE($9, next_visit_date),
         preferred_visit_time = CASE WHEN $10::boolean THEN $11 ELSE preferred_visit_time END,
         assigned_engineer_name = CASE WHEN $12::boolean THEN $13 ELSE assigned_engineer_name END,
         assigned_service_team = CASE WHEN $14::boolean THEN $15 ELSE assigned_service_team END,
         service_contact = CASE WHEN $16::boolean THEN $17 ELSE service_contact END,
         site_id = COALESCE($18, site_id),
         customer_id = COALESCE($19, customer_id)
     WHERE id = $1 AND company_id = $2
     RETURNING ${CONTRACT_COLUMNS}`,
    [
      id,
      companyId,
      fields.amcType || null,
      fields.coverage || null,
      fields.startDate || null,
      fields.endDate || null,
      fields.visitFrequency || null,
      fields.visitsPerYear ?? null,
      fields.nextVisitDate || null,
      fields.setPreferredVisitTime === true,
      fields.preferredVisitTime || null,
      fields.setEngineer === true,
      fields.assignedEngineerName || null,
      fields.setTeam === true,
      fields.assignedServiceTeam || null,
      fields.setContact === true,
      fields.serviceContact || null,
      fields.siteId || null,
      fields.customerId || null,
    ],
  );
  return result.rows[0] || null;
}

async function setContractStatus(id, companyId, status, client) {
  const result = await db(client).query(
    `UPDATE amc_contracts
     SET status = $3
     WHERE id = $1 AND company_id = $2
     RETURNING ${CONTRACT_COLUMNS}`,
    [id, companyId, status],
  );
  return result.rows[0] || null;
}

async function setContractNextVisit(id, companyId, nextVisitDate, nextVisitTime, client) {
  const result = await db(client).query(
    `UPDATE amc_contracts
     SET next_visit_date = $3,
         preferred_visit_time = COALESCE($4, preferred_visit_time)
     WHERE id = $1 AND company_id = $2
     RETURNING ${CONTRACT_COLUMNS}`,
    [id, companyId, nextVisitDate, nextVisitTime || null],
  );
  return result.rows[0] || null;
}

async function countOpenRequests(contractId, companyId, client) {
  const result = await db(client).query(
    `SELECT COUNT(*)::int AS count
     FROM amc_requests
     WHERE contract_id = $1
       AND company_id = $2
       AND status NOT IN ('completed', 'cancelled')`,
    [contractId, companyId],
  );
  return result.rows[0].count;
}

async function insertRequest(record, client) {
  const result = await db(client).query(
    `INSERT INTO amc_requests (
       customer_id, company_id, site_id, contract_id, request_number, request_type,
       service_requirement, preferred_date, preferred_time, description,
       status, submitted_at
     )
     VALUES (
       $1,$2,$3,$4,
       'AMR-' || to_char(NOW() AT TIME ZONE 'UTC', 'YYYY') || '-' || lpad(nextval('amc_request_number_seq')::text, 6, '0'),
       $5,$6,$7,$8,$9,$10,$11
     )
     RETURNING ${REQUEST_COLUMNS}`,
    [
      record.customerId,
      record.companyId,
      record.siteId,
      record.existingContractId || null,
      record.requestType,
      record.requestedService,
      record.preferredDate || null,
      record.preferredTime || null,
      record.description || null,
      record.status,
      record.submittedAt || null,
    ],
  );
  return result.rows[0];
}

async function findRequest(id, companyId, client, forUpdate = false) {
  const result = await db(client).query(
    `SELECT ${REQUEST_COLUMNS}
     FROM amc_requests
     WHERE id = $1 AND company_id = $2${lockSql(forUpdate)}`,
    [id, companyId],
  );
  return result.rows[0] || null;
}

async function listRequests({ companyId, status, siteId, contractId, q, limit, offset }, client) {
  const values = [];
  const where = [];
  addEq(where, values, 'r.company_id', companyId);
  addEq(where, values, 'r.status', status);
  addEq(where, values, 'r.site_id', siteId);
  addEq(where, values, 'r.contract_id', contractId);
  addLike(where, values, ['r.service_requirement', 'r.description', 'c.contract_number'], q);
  return selectPaged(db(client), {
    select: `r.id, r.customer_id, r.company_id, r.site_id, r.contract_id, r.request_number, r.request_type,
             r.service_requirement, r.preferred_date, r.preferred_time, r.description, r.scheduled_date,
             r.scheduled_time, r.status, r.submitted_at, r.cancelled_at, r.completed_at, r.created_at,
             r.updated_at, c.contract_number`,
    from: 'amc_requests r LEFT JOIN amc_contracts c ON c.id = r.contract_id',
    where,
    values,
    order: 'r.created_at DESC',
    limit,
    offset,
  });
}

async function updateRequest(id, companyId, fields, client) {
  const result = await db(client).query(
    `UPDATE amc_requests
     SET site_id = COALESCE($3, site_id),
         contract_id = CASE WHEN $4::boolean THEN $5::uuid ELSE contract_id END,
         request_type = COALESCE($6, request_type),
         service_requirement = COALESCE($7, service_requirement),
         preferred_date = COALESCE($8::date, preferred_date),
         preferred_time = CASE WHEN $9::boolean THEN $10 ELSE preferred_time END,
         description = CASE WHEN $11::boolean THEN $12 ELSE description END
     WHERE id = $1 AND company_id = $2 AND status = 'draft'
     RETURNING ${REQUEST_COLUMNS}`,
    [
      id,
      companyId,
      fields.siteId || null,
      fields.setContract === true,
      fields.existingContractId || null,
      fields.requestType || null,
      fields.requestedService || null,
      fields.preferredDate || null,
      fields.setPreferredTime === true,
      fields.preferredTime || null,
      fields.setDescription === true,
      fields.description || null,
    ],
  );
  return result.rows[0] || null;
}

async function setRequestStatus(id, companyId, fields, client) {
  const result = await db(client).query(
    `UPDATE amc_requests
     SET status = $3,
         scheduled_date = COALESCE($4::date, scheduled_date),
         scheduled_time = CASE WHEN $5::boolean THEN $6 ELSE scheduled_time END,
         submitted_at = COALESCE(submitted_at, $7),
         cancelled_at = CASE WHEN $3 = 'cancelled' THEN COALESCE(cancelled_at, NOW()) ELSE cancelled_at END,
         completed_at = CASE WHEN $3 = 'completed' THEN COALESCE(completed_at, NOW()) ELSE completed_at END
     WHERE id = $1 AND company_id = $2
     RETURNING ${REQUEST_COLUMNS}`,
    [
      id,
      companyId,
      fields.status,
      fields.scheduledDate || null,
      fields.setScheduledTime === true,
      fields.scheduledTime || null,
      fields.submittedAt || null,
    ],
  );
  return result.rows[0] || null;
}

async function insertReschedule(record, client) {
  const result = await db(client).query(
    `INSERT INTO amc_reschedules (
       amc_request_id, amc_contract_id, customer_id, company_id, previous_schedule,
       requested_schedule, requested_time, reason, notes, status, previous_request_status
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending',$10)
     RETURNING ${RESCHEDULE_COLUMNS}`,
    [
      record.amcRequestId || null,
      record.amcContractId || null,
      record.customerId,
      record.companyId,
      record.oldScheduledDate,
      record.requestedNewDate,
      record.requestedNewTime || null,
      record.reason,
      record.notes || null,
      record.previousRequestStatus || null,
    ],
  );
  return result.rows[0];
}

async function findReschedule(id, companyId, client, forUpdate = false) {
  const result = await db(client).query(
    `SELECT ${RESCHEDULE_COLUMNS}
     FROM amc_reschedules
     WHERE id = $1 AND company_id = $2${lockSql(forUpdate)}`,
    [id, companyId],
  );
  return result.rows[0] || null;
}

async function hasPendingVisit({ companyId, requestId, contractId }, client) {
  const result = await db(client).query(
    `SELECT id
     FROM amc_reschedules
     WHERE company_id = $1
       AND status = 'pending'
       AND (
         ($2::uuid IS NOT NULL AND amc_request_id = $2)
         OR ($3::uuid IS NOT NULL AND amc_contract_id = $3)
       )
     LIMIT 1`,
    [companyId, requestId || null, contractId || null],
  );
  return result.rows[0] || null;
}

async function findPendingReschedule({ requestId, contractId, companyId }, client, forUpdate = false) {
  const result = await db(client).query(
    `SELECT ${RESCHEDULE_COLUMNS}
     FROM amc_reschedules
     WHERE company_id = $1
       AND status = 'pending'
       AND (
         ($2::uuid IS NOT NULL AND amc_request_id = $2)
         OR ($3::uuid IS NOT NULL AND amc_request_id IS NULL AND amc_contract_id = $3)
       )
     ${lockSql(forUpdate)}`,
    [companyId, requestId || null, contractId || null],
  );
  return result.rows[0] || null;
}

async function listReschedules({ companyId, status, requestId, contractId, limit, offset }, client) {
  const values = [];
  const where = [];
  addEq(where, values, 'company_id', companyId);
  addEq(where, values, 'status', status);
  addEq(where, values, 'amc_request_id', requestId);
  addEq(where, values, 'amc_contract_id', contractId);
  return selectPaged(db(client), {
    select: RESCHEDULE_COLUMNS,
    from: 'amc_reschedules',
    where,
    values,
    order: 'created_at DESC',
    limit,
    offset,
  });
}

async function closeReschedule(id, companyId, fields, client) {
  const result = await db(client).query(
    `UPDATE amc_reschedules
     SET status = $3,
         reviewed_by = $4,
         reviewed_at = NOW(),
         review_note = $5
     WHERE id = $1 AND company_id = $2 AND status = 'pending'
     RETURNING ${RESCHEDULE_COLUMNS}`,
    [id, companyId, fields.status, fields.reviewedBy || null, fields.reviewNote || null],
  );
  return result.rows[0] || null;
}

async function cancelPendingForRequest(requestId, companyId, reviewedBy, client) {
  const result = await db(client).query(
    `UPDATE amc_reschedules
     SET status = 'cancelled', reviewed_by = $3, reviewed_at = NOW()
     WHERE amc_request_id = $1 AND company_id = $2 AND status = 'pending'
     RETURNING ${RESCHEDULE_COLUMNS}`,
    [requestId, companyId, reviewedBy],
  );
  return result.rows;
}

module.exports = {
  nextContractNumber,
  insertContract,
  findContract,
  listContracts,
  countActiveContracts,
  updateContract,
  setContractStatus,
  setContractNextVisit,
  countOpenRequests,
  insertRequest,
  findRequest,
  listRequests,
  updateRequest,
  setRequestStatus,
  insertReschedule,
  findReschedule,
  hasPendingVisit,
  findPendingReschedule,
  listReschedules,
  closeReschedule,
  cancelPendingForRequest,
};
