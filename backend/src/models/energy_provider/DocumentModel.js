const { db, nowIso } = require('../../db/energy_provider/index');
const { insertInto, updateTable } = require('./helpers');

const TABLE = 'partner_documents';

const DocumentModel = {
  TABLE,

  findById: async (id, handle = db) =>
    handle.get(`SELECT * FROM \`${TABLE}\` WHERE \`id\` = ?`, [id]),

  findByApplication: async (applicationId, handle = db) =>
    handle.query(
      `SELECT * FROM \`${TABLE}\` WHERE \`application_id\` = ? ORDER BY \`id\``,
      [applicationId]
    ),

  findByUser: async (userId, handle = db) =>
    handle.query(`SELECT * FROM \`${TABLE}\` WHERE \`user_id\` = ? ORDER BY \`id\``, [userId]),

  findByTypeAndApplication: async (applicationId, docType, handle = db) =>
    handle.get(
      `SELECT * FROM \`${TABLE}\` WHERE \`application_id\` = ? AND \`doc_type\` = ?`,
      [applicationId, docType]
    ),

  create: async (docData, handle = db) => {
    const id = await insertInto(
      TABLE,
      {
        application_id: docData.applicationId || null,
        user_id: docData.userId || null,
        doc_type: docData.docType,
        file_name: docData.fileName || '',
        file_ref: docData.fileRef || '',
        mime_type: docData.mimeType || '',
        size_bytes: docData.sizeBytes || 0,
        status: docData.status || 'pending',
        created_at: nowIso(),
      },
      handle
    );
    return DocumentModel.findById(id, handle);
  },

  updateById: async (id, updates, handle = db) => {
    await updateTable(TABLE, id, updates, handle);
    return DocumentModel.findById(id, handle);
  },

  deleteById: async (id, handle = db) => {
    const result = await handle.run(`DELETE FROM \`${TABLE}\` WHERE \`id\` = ?`, [id]);
    return result.affectedRows > 0;
  },

  toApi: (row) => ({
    id: row.id,
    applicationId: row.application_id,
    userId: row.user_id,
    type: row.doc_type,
    fileName: row.file_name,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    status: row.status,
    rejectionReason: row.rejection_reason,
    createdAt: row.created_at,
  }),
};

module.exports = DocumentModel;
