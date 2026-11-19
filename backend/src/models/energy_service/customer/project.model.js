const { db, addEq, addLike, selectPaged } = require('./query');

const REQUEST_COLUMNS = `
  r.id, r.customer_id, r.company_id, r.site_id, r.category_id, r.project_type_id,
  r.request_number, r.title, r.description, r.requirements, r.estimated_scope, r.preferred_timeline,
  r.budget_amount, r.budget_currency, r.status, r.submitted_at, r.cancelled_at,
  r.completed_at, r.created_at, r.updated_at,
  c.code AS category_code, c.name AS category_name,
  t.code AS project_type_code, t.name AS project_type_name
`;

function lockSql(forUpdate) {
  return forUpdate ? ' FOR UPDATE OF r' : '';
}

async function listCatalog(client) {
  const result = await db(client).query(
    `SELECT c.code AS category_code, c.name AS category_name, c.sort_order AS category_sort,
            t.code AS type_code, t.name AS type_name, t.sort_order AS type_sort
     FROM project_categories c
     JOIN project_types t ON t.category_id = c.id AND t.active = TRUE
     WHERE c.active = TRUE
     ORDER BY c.sort_order ASC, t.sort_order ASC`,
  );
  return result.rows;
}

async function findType(categoryCode, typeCode, client) {
  const result = await db(client).query(
    `SELECT t.id AS type_id, t.code AS type_code, t.name AS type_name,
            c.id AS category_id, c.code AS category_code, c.name AS category_name
     FROM project_types t
     JOIN project_categories c ON c.id = t.category_id
     WHERE c.code = $1 AND t.code = $2 AND c.active = TRUE AND t.active = TRUE`,
    [categoryCode, typeCode],
  );
  return result.rows[0] || null;
}

async function insertRequest(record, client) {
  const result = await db(client).query(
    `INSERT INTO project_requests (
       customer_id, company_id, site_id, category_id, project_type_id, request_number, title,
       description, requirements, estimated_scope, preferred_timeline,
       budget_amount, budget_currency, status, submitted_at
     )
     VALUES (
       $1,$2,$3,$4,$5,
       'PRJ-' || to_char(NOW() AT TIME ZONE 'UTC', 'YYYY') || '-' || lpad(nextval('project_request_number_seq')::text, 6, '0'),
       $6,$7,$8,$9,$10,$11,$12,$13,$14
     )
     RETURNING id`,
    [
      record.customerId,
      record.companyId,
      record.siteId,
      record.categoryId,
      record.projectTypeId,
      record.title,
      record.description,
      record.requirements || null,
      record.estimatedScope || null,
      record.preferredTimeline || null,
      record.budgetAmount ?? null,
      record.budgetCurrency || null,
      record.status,
      record.submittedAt || null,
    ],
  );
  return findRequest(result.rows[0].id, record.companyId, client);
}

async function findRequest(id, companyId, client, forUpdate = false) {
  const result = await db(client).query(
    `SELECT ${REQUEST_COLUMNS}
     FROM project_requests r
     JOIN project_categories c ON c.id = r.category_id
     JOIN project_types t ON t.id = r.project_type_id
     WHERE r.id = $1 AND r.company_id = $2${lockSql(forUpdate)}`,
    [id, companyId],
  );
  return result.rows[0] || null;
}

async function listRequests({ companyId, status, siteId, category, projectType, q, limit, offset }, client) {
  const values = [];
  const where = [];
  addEq(where, values, 'r.company_id', companyId);
  addEq(where, values, 'r.status', status);
  addEq(where, values, 'r.site_id', siteId);
  addEq(where, values, 'c.code', category);
  addEq(where, values, 't.code', projectType);
  addLike(where, values, ['r.title', 'r.description', 'r.requirements', 'c.name', 't.name'], q);
  return selectPaged(db(client), {
    select: REQUEST_COLUMNS,
    from: `project_requests r
           JOIN project_categories c ON c.id = r.category_id
           JOIN project_types t ON t.id = r.project_type_id`,
    where,
    values,
    order: 'r.created_at DESC',
    limit,
    offset,
  });
}

async function updateRequest(id, companyId, fields, allowedStatuses, client) {
  const result = await db(client).query(
    `UPDATE project_requests
     SET site_id = COALESCE($3, site_id),
         category_id = COALESCE($4, category_id),
         project_type_id = COALESCE($5, project_type_id),
         title = COALESCE($6, title),
         description = COALESCE($7, description),
         requirements = CASE WHEN $8::boolean THEN $9 ELSE requirements END,
         estimated_scope = CASE WHEN $10::boolean THEN $11 ELSE estimated_scope END,
         preferred_timeline = CASE WHEN $12::boolean THEN $13 ELSE preferred_timeline END,
         budget_amount = CASE WHEN $14::boolean THEN $15 ELSE budget_amount END,
         budget_currency = CASE WHEN $14::boolean THEN $16 ELSE budget_currency END
     WHERE id = $1 AND company_id = $2 AND status = ANY($17::varchar[])
     RETURNING id`,
    [
      id,
      companyId,
      fields.siteId || null,
      fields.categoryId || null,
      fields.projectTypeId || null,
      fields.title || null,
      fields.description || null,
      fields.setRequirements === true,
      fields.requirements || null,
      fields.setScope === true,
      fields.estimatedScope || null,
      fields.setTimeline === true,
      fields.preferredTimeline || null,
      fields.setBudget === true,
      fields.budgetAmount ?? null,
      fields.budgetCurrency || null,
      allowedStatuses,
    ],
  );
  if (!result.rows[0]) return null;
  return findRequest(id, companyId, client);
}

async function setRequestStatus(id, companyId, fields, client) {
  await db(client).query(
    `UPDATE project_requests
     SET status = $3,
         submitted_at = COALESCE(submitted_at, $4),
         cancelled_at = CASE WHEN $3 = 'cancelled' THEN COALESCE(cancelled_at, NOW()) ELSE cancelled_at END,
         completed_at = CASE WHEN $3 = 'completed' THEN COALESCE(completed_at, NOW()) ELSE completed_at END
     WHERE id = $1 AND company_id = $2`,
    [id, companyId, fields.status, fields.submittedAt || null],
  );
  return findRequest(id, companyId, client);
}

async function listDetails(projectRequestId, client) {
  const result = await db(client).query(
    `SELECT id, field_key, field_value, data_type
     FROM project_request_details
     WHERE project_request_id = $1
     ORDER BY field_key ASC`,
    [projectRequestId],
  );
  return result.rows;
}

async function replaceDetails(projectRequestId, details, client) {
  await db(client).query(
    `DELETE FROM project_request_details WHERE project_request_id = $1`,
    [projectRequestId],
  );
  for (const item of details) {
    await db(client).query(
      `INSERT INTO project_request_details (project_request_id, field_key, field_value, data_type)
       VALUES ($1, $2, $3, $4)`,
      [projectRequestId, item.key, item.value ?? null, item.dataType || 'text'],
    );
  }
}

module.exports = {
  listCatalog,
  findType,
  insertRequest,
  findRequest,
  listRequests,
  updateRequest,
  setRequestStatus,
  listDetails,
  replaceDetails,
};
