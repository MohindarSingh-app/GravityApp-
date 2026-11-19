const { db, addEq, addLike, selectPaged } = require('./query');

const DEVICE_COLUMNS = `
  id, customer_id, company_id, site_id, device_type, manufacturer, model,
  serial_number, asset_number, location, power_rating, description, created_at, updated_at
`;

const TICKET_COLUMNS = `
  id, ticket_number, customer_id, company_id, site_id, device_id, repair_scope,
  service_type, priority, requested_turnaround, additional_requirements, issue_description,
  symptoms, error_details, status, submitted_at, cancelled_at, completed_at,
  created_at, updated_at
`;

function lockSql(forUpdate) {
  return forUpdate ? ' FOR UPDATE' : '';
}

async function nextTicketNumber(client) {
  const result = await db(client).query(
    `SELECT 'RPR-' || to_char(NOW() AT TIME ZONE 'UTC', 'YYYY') || '-' ||
            lpad(nextval('repair_ticket_number_seq')::text, 6, '0') AS ticket_number`,
  );
  return result.rows[0].ticket_number;
}

async function insertDevice(record, client) {
  const result = await db(client).query(
    `INSERT INTO devices (
       customer_id, company_id, site_id, device_type, manufacturer, model,
       serial_number, asset_number, location, power_rating, description
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING ${DEVICE_COLUMNS}`,
    [
      record.customerId,
      record.companyId,
      record.siteId,
      record.deviceType,
      record.manufacturer,
      record.model,
      record.serialNumber,
      record.assetNumber || null,
      record.installationLocation,
      record.powerRating || null,
      record.description || null,
    ],
  );
  return result.rows[0];
}

async function findDevice(id, companyId, client, forUpdate = false) {
  const result = await db(client).query(
    `SELECT ${DEVICE_COLUMNS}
     FROM devices
     WHERE id = $1 AND company_id = $2${lockSql(forUpdate)}`,
    [id, companyId],
  );
  return result.rows[0] || null;
}

async function listDevices({ companyId, siteId, deviceType, q, limit, offset }, client) {
  const values = [];
  const where = [];
  addEq(where, values, 'company_id', companyId);
  addEq(where, values, 'site_id', siteId);
  addEq(where, values, 'device_type', deviceType);
  addLike(where, values, ['serial_number', 'model', 'manufacturer', 'asset_number', 'location'], q);
  return selectPaged(db(client), {
    select: DEVICE_COLUMNS,
    from: 'devices',
    where,
    values,
    order: 'created_at DESC',
    limit,
    offset,
  });
}

async function updateDevice(id, companyId, fields, client) {
  const result = await db(client).query(
    `UPDATE devices
     SET site_id = COALESCE($3, site_id),
         device_type = COALESCE($4, device_type),
         manufacturer = COALESCE($5, manufacturer),
         model = COALESCE($6, model),
         serial_number = COALESCE($7, serial_number),
         asset_number = CASE WHEN $8::boolean THEN $9 ELSE asset_number END,
         location = COALESCE($10, location),
         power_rating = COALESCE($11, power_rating),
         description = CASE WHEN $12::boolean THEN $13 ELSE description END
     WHERE id = $1 AND company_id = $2
     RETURNING ${DEVICE_COLUMNS}`,
    [
      id,
      companyId,
      fields.siteId || null,
      fields.deviceType || null,
      fields.manufacturer || null,
      fields.model || null,
      fields.serialNumber || null,
      fields.setAssetNumber === true,
      fields.assetNumber || null,
      fields.installationLocation || null,
      fields.powerRating || null,
      fields.setDescription === true,
      fields.description || null,
    ],
  );
  return result.rows[0] || null;
}

async function insertTicket(record, client) {
  const result = await db(client).query(
    `INSERT INTO repair_tickets (
       ticket_number, customer_id, company_id, site_id, device_id, repair_scope,
       service_type, priority, requested_turnaround, additional_requirements,
       issue_description, symptoms, error_details, status, submitted_at
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     RETURNING ${TICKET_COLUMNS}`,
    [
      record.ticketNumber,
      record.customerId,
      record.companyId,
      record.siteId,
      record.deviceId || null,
      record.repairScope || null,
      record.serviceType || null,
      record.priority || null,
      record.requestedTurnaround || null,
      record.additionalRequirements || null,
      record.issueDescription || null,
      record.symptoms || null,
      record.faultInformation || null,
      record.status,
      record.submittedAt || null,
    ],
  );
  return result.rows[0];
}

async function findTicket(id, companyId, client, forUpdate = false) {
  const result = await db(client).query(
    `SELECT ${TICKET_COLUMNS}
     FROM repair_tickets
     WHERE id = $1 AND company_id = $2${lockSql(forUpdate)}`,
    [id, companyId],
  );
  return result.rows[0] || null;
}

async function listTickets({ companyId, status, siteId, deviceId, priority, q, limit, offset }, client) {
  const values = [];
  const where = [];
  addEq(where, values, 't.company_id', companyId);
  addEq(where, values, 't.status', status);
  addEq(where, values, 't.site_id', siteId);
  addEq(where, values, 't.device_id', deviceId);
  addEq(where, values, 't.priority', priority);
  addLike(where, values, ['t.ticket_number', 't.issue_description', 't.symptoms', 'd.serial_number', 'd.model'], q);
  return selectPaged(db(client), {
    select: `t.id, t.ticket_number, t.customer_id, t.company_id, t.site_id, t.device_id, t.repair_scope,
             t.service_type, t.priority, t.requested_turnaround, t.additional_requirements, t.issue_description,
             t.symptoms, t.error_details, t.status, t.submitted_at, t.cancelled_at, t.completed_at,
             t.created_at, t.updated_at,
             d.device_type AS device_type, d.manufacturer AS device_manufacturer, d.model AS device_model,
             d.serial_number AS device_serial_number, d.asset_number AS device_asset_number,
             d.location AS device_location`,
    from: 'repair_tickets t LEFT JOIN devices d ON d.id = t.device_id',
    where,
    values,
    order: 't.created_at DESC',
    limit,
    offset,
  });
}

async function updateTicket(id, companyId, fields, client) {
  const result = await db(client).query(
    `UPDATE repair_tickets
     SET site_id = COALESCE($3, site_id),
         device_id = CASE WHEN $4::boolean THEN $5::uuid ELSE device_id END,
         repair_scope = COALESCE($6, repair_scope),
         service_type = COALESCE($7, service_type),
         priority = COALESCE($8, priority),
         requested_turnaround = CASE WHEN $9::boolean THEN $10 ELSE requested_turnaround END,
         additional_requirements = CASE WHEN $11::boolean THEN $12 ELSE additional_requirements END,
         issue_description = COALESCE($13, issue_description),
         symptoms = CASE WHEN $14::boolean THEN $15 ELSE symptoms END,
         error_details = CASE WHEN $16::boolean THEN $17 ELSE error_details END
     WHERE id = $1 AND company_id = $2 AND status = 'draft'
     RETURNING ${TICKET_COLUMNS}`,
    [
      id,
      companyId,
      fields.siteId || null,
      fields.setDevice === true,
      fields.deviceId || null,
      fields.repairScope || null,
      fields.serviceType || null,
      fields.priority || null,
      fields.setTurnaround === true,
      fields.requestedTurnaround || null,
      fields.setRequirements === true,
      fields.additionalRequirements || null,
      fields.issueDescription || null,
      fields.setSymptoms === true,
      fields.symptoms || null,
      fields.setFault === true,
      fields.faultInformation || null,
    ],
  );
  return result.rows[0] || null;
}

async function setTicketStatus(id, companyId, fields, client) {
  const result = await db(client).query(
    `UPDATE repair_tickets
     SET status = $3,
         submitted_at = COALESCE(submitted_at, $4),
         cancelled_at = CASE WHEN $3 = 'cancelled' THEN COALESCE(cancelled_at, NOW()) ELSE cancelled_at END,
         completed_at = CASE WHEN $3 = 'completed' THEN COALESCE(completed_at, NOW()) ELSE completed_at END
     WHERE id = $1 AND company_id = $2
     RETURNING ${TICKET_COLUMNS}`,
    [id, companyId, fields.status, fields.submittedAt || null],
  );
  return result.rows[0] || null;
}

module.exports = {
  nextTicketNumber,
  insertDevice,
  findDevice,
  listDevices,
  updateDevice,
  insertTicket,
  findTicket,
  listTickets,
  updateTicket,
  setTicketStatus,
};
