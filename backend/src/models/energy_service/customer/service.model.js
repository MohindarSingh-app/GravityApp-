const { db, addEq, addLike, selectPaged } = require('./query');

const REQUEST_COLUMNS = `
  r.id, r.customer_id, r.company_id, r.site_id, r.category_id, r.request_number,
  r.status, r.priority, r.preferred_date, r.preferred_time, r.assigned_engineer_name,
  r.assigned_at, r.submitted_at, r.cancelled_at, r.completed_at, r.created_at, r.updated_at,
  c.code AS category_code, c.name AS category_name,
  s.site_name, s.address AS site_address, s.city AS site_city, s.site_type,
  co.company_name,
  st.name AS status_label
`;

function lockSql(forUpdate) {
  return forUpdate ? ' FOR UPDATE OF r' : '';
}

async function listCategories(client) {
  const result = await db(client).query(
    `SELECT id, code, name, summary, intro, icon_key, sort_order, status
     FROM service_categories
     WHERE status = 'active'
     ORDER BY sort_order ASC, name ASC`,
  );
  return result.rows;
}

async function findCategory(id, client) {
  const result = await db(client).query(
    `SELECT id, code, name, summary, intro, icon_key, sort_order, status
     FROM service_categories
     WHERE id = $1 AND status = 'active'`,
    [id],
  );
  return result.rows[0] || null;
}

async function listSteps(categoryId, client) {
  const result = await db(client).query(
    `SELECT id, category_id, parent_option_id, follows_step_id, code, title, summary,
            step_kind, sort_order, status
     FROM service_steps
     WHERE category_id = $1 AND status = 'active'
     ORDER BY sort_order ASC, code ASC`,
    [categoryId],
  );
  return result.rows;
}

async function listOptions(stepIds, client) {
  if (!stepIds.length) return [];
  const result = await db(client).query(
    `SELECT id, step_id, code, name, summary, icon_key, sort_order, status, next_action, next_action_label
     FROM service_options
     WHERE step_id = ANY($1::uuid[]) AND status = 'active'
     ORDER BY sort_order ASC, name ASC`,
    [stepIds],
  );
  return result.rows;
}

async function listFields(stepIds, client) {
  if (!stepIds.length) return [];
  const result = await db(client).query(
    `SELECT id, step_id, field_key, label, field_type, required, placeholder, help_text, sort_order, status
     FROM service_form_fields
     WHERE step_id = ANY($1::uuid[]) AND status = 'active'
     ORDER BY sort_order ASC, label ASC`,
    [stepIds],
  );
  return result.rows;
}

async function listFieldOptions(fieldIds, client) {
  if (!fieldIds.length) return [];
  const result = await db(client).query(
    `SELECT id, field_id, value, label, summary, sort_order, status
     FROM service_field_options
     WHERE field_id = ANY($1::uuid[]) AND status = 'active'
     ORDER BY sort_order ASC, label ASC`,
    [fieldIds],
  );
  return result.rows;
}

async function listStatuses(client) {
  const result = await db(client).query(
    `SELECT code, name, sort_order
     FROM service_request_statuses
     ORDER BY sort_order ASC`,
  );
  return result.rows;
}

async function insertRequest(record, client) {
  const result = await db(client).query(
    `INSERT INTO service_requests (
       customer_id, company_id, site_id, category_id, request_number, status, priority,
       preferred_date, preferred_time, submitted_at
     )
     VALUES (
       $1, $2, $3, $4,
       'QS-' || to_char(NOW() AT TIME ZONE 'UTC', 'YYYY') || '-' || lpad(nextval('service_request_number_seq')::text, 6, '0'),
       $5, $6, $7, $8, NOW()
     )
     RETURNING id`,
    [
      record.customerId,
      record.companyId,
      record.siteId,
      record.categoryId,
      record.status,
      record.priority,
      record.preferredDate,
      record.preferredTime,
    ],
  );
  return findRequest(result.rows[0].id, record.companyId, client);
}

async function insertSelections(requestId, choices, client) {
  for (let index = 0; index < choices.length; index += 1) {
    const choice = choices[index];
    await db(client).query(
      `INSERT INTO service_request_selections (request_id, step_id, option_id, sort_order)
       VALUES ($1, $2, $3, $4)`,
      [requestId, choice.step.id, choice.option.id, index + 1],
    );
  }
}

async function insertAnswers(requestId, answers, client) {
  for (const answer of answers) {
    await db(client).query(
      `INSERT INTO service_request_answers (request_id, field_id, value_text)
       VALUES ($1, $2, $3)`,
      [requestId, answer.fieldId, answer.valueText],
    );
  }
}

async function findRequest(id, companyId, client, forUpdate = false) {
  const result = await db(client).query(
    `SELECT ${REQUEST_COLUMNS}
     FROM service_requests r
     JOIN service_categories c ON c.id = r.category_id
     JOIN sites s ON s.id = r.site_id
     JOIN companies co ON co.id = r.company_id
     JOIN service_request_statuses st ON st.code = r.status
     WHERE r.id = $1 AND r.company_id = $2${lockSql(forUpdate)}`,
    [id, companyId],
  );
  return result.rows[0] || null;
}

async function listSelections(requestId, client) {
  const result = await db(client).query(
    `SELECT sel.sort_order, sel.step_id, sel.option_id,
            step.title AS step_title, step.code AS step_code,
            opt.name AS option_name, opt.summary AS option_summary, opt.code AS option_code,
            opt.next_action, opt.next_action_label
     FROM service_request_selections sel
     JOIN service_steps step ON step.id = sel.step_id
     JOIN service_options opt ON opt.id = sel.option_id
     WHERE sel.request_id = $1
     ORDER BY sel.sort_order ASC`,
    [requestId],
  );
  return result.rows;
}

async function listAnswers(requestId, client) {
  const result = await db(client).query(
    `SELECT a.field_id, a.value_text, f.field_key, f.label, f.field_type, f.sort_order
     FROM service_request_answers a
     JOIN service_form_fields f ON f.id = a.field_id
     WHERE a.request_id = $1
     ORDER BY f.sort_order ASC, f.label ASC`,
    [requestId],
  );
  return result.rows;
}

async function listRequests(filters, client) {
  const where = ['r.company_id = $1'];
  const values = [filters.companyId];
  addEq(where, values, 'r.status', filters.status);
  addEq(where, values, 'r.site_id', filters.siteId);
  addEq(where, values, 'r.category_id', filters.categoryId);
  addLike(where, values, ['r.request_number', 'c.name', 's.site_name'], filters.q);
  return selectPaged(db(client), {
    select: REQUEST_COLUMNS,
    from: `service_requests r
      JOIN service_categories c ON c.id = r.category_id
      JOIN sites s ON s.id = r.site_id
      JOIN companies co ON co.id = r.company_id
      JOIN service_request_statuses st ON st.code = r.status`,
    where,
    values,
    order: 'r.created_at DESC',
    limit: filters.limit,
    offset: filters.offset,
  });
}

async function setStatus(id, companyId, record, client) {
  const result = await db(client).query(
    `UPDATE service_requests
     SET status = $3,
         assigned_engineer_name = CASE WHEN $4::boolean THEN $5 ELSE assigned_engineer_name END,
         assigned_at = CASE WHEN $3 = 'assigned' THEN NOW() ELSE assigned_at END,
         cancelled_at = CASE WHEN $3 = 'cancelled' THEN NOW() ELSE cancelled_at END,
         completed_at = CASE WHEN $3 = 'completed' THEN NOW() ELSE completed_at END
     WHERE id = $1 AND company_id = $2
     RETURNING id`,
    [id, companyId, record.status, record.setEngineer === true, record.assignedEngineerName || null],
  );
  if (!result.rows[0]) return null;
  return findRequest(id, companyId, client);
}

module.exports = {
  listCategories,
  findCategory,
  listSteps,
  listOptions,
  listFields,
  listFieldOptions,
  listStatuses,
  insertRequest,
  insertSelections,
  insertAnswers,
  findRequest,
  listSelections,
  listAnswers,
  listRequests,
  setStatus,
};
