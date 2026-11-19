const { db } = require('./query');

const COLUMNS = `
  id, company_id, uploaded_by, entity_type, entity_id, file_name, mime_type,
  file_reference, byte_size, created_at, updated_at
`;

async function insert(record, client) {
  const result = await db(client).query(
    `INSERT INTO attachments (
       company_id, uploaded_by, file_name, mime_type, file_reference, byte_size
     )
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING ${COLUMNS}`,
    [
      record.companyId,
      record.uploadedBy,
      record.fileName,
      record.mimeType,
      record.fileReference,
      record.byteSize ?? null,
    ],
  );
  return result.rows[0];
}

async function lockByIds(ids, companyId, client) {
  if (!ids.length) return [];
  const result = await db(client).query(
    `SELECT ${COLUMNS}
     FROM attachments
     WHERE company_id = $1 AND id = ANY($2::uuid[])
     FOR UPDATE`,
    [companyId, ids],
  );
  return result.rows;
}

async function assignEntity(ids, companyId, entityType, entityId, client) {
  if (!ids.length) return;
  await db(client).query(
    `UPDATE attachments
     SET entity_type = $3, entity_id = $4
     WHERE company_id = $1 AND id = ANY($2::uuid[])`,
    [companyId, ids, entityType, entityId],
  );
}

async function releaseExcept(companyId, entityType, entityId, keepIds, client) {
  await db(client).query(
    `UPDATE attachments
     SET entity_type = NULL, entity_id = NULL
     WHERE company_id = $1
       AND entity_type = $2
       AND entity_id = $3
       AND NOT (id = ANY($4::uuid[]))`,
    [companyId, entityType, entityId, keepIds],
  );
}

async function listByEntity(companyId, entityType, entityId, client) {
  const result = await db(client).query(
    `SELECT ${COLUMNS}
     FROM attachments
     WHERE company_id = $1 AND entity_type = $2 AND entity_id = $3
     ORDER BY created_at ASC`,
    [companyId, entityType, entityId],
  );
  return result.rows;
}

async function findById(companyId, id, client) {
  const result = await db(client).query(
    `SELECT ${COLUMNS}
     FROM attachments
     WHERE company_id = $1 AND id = $2`,
    [companyId, id],
  );
  return result.rows[0] || null;
}

module.exports = {
  insert,
  lockByIds,
  assignEntity,
  releaseExcept,
  listByEntity,
  findById,
};
