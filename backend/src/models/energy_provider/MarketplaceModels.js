/**
 * Models for the remaining marketplace tables: workflow steps, parts, photos,
 * stage history, partner responses, earnings, notifications and audit logs.
 * They are grouped in one module because each is a thin CRUD wrapper.
 */

const { db, nowIso } = require('../../db/energy_provider/index');
const { insertInto, updateTable } = require('./helpers');

/**
 * Build a small CRUD model for a table whose columns map 1:1 to the API shape.
 */
const makeCrud = (table, { columns, defaults = {} }) => {
  const buildRow = (data) => {
    const row = {};
    for (const [key, column] of Object.entries(columns)) {
      const value = data[key] !== undefined ? data[key] : defaults[key];
      if (value !== undefined) row[column] = value;
    }
    return row;
  };

  return {
    TABLE: table,

    findById: async (id, handle = db) =>
      handle.get(`SELECT * FROM \`${table}\` WHERE \`id\` = ?`, [id]),

    findByJob: async (jobId, handle = db) =>
      handle.query(`SELECT * FROM \`${table}\` WHERE \`job_id\` = ? ORDER BY \`id\``, [jobId]),

    create: async (data, handle = db) => {
      const id = await insertInto(table, { ...buildRow(data), created_at: nowIso() }, handle);
      return handle.get(`SELECT * FROM \`${table}\` WHERE \`id\` = ?`, [id]);
    },

    updateById: async (id, updates, handle = db) => {
      const payload = {};
      for (const [key, column] of Object.entries(columns)) {
        if (updates[key] !== undefined) payload[column] = updates[key];
      }
      if (!Object.keys(payload).length) {
        return handle.get(`SELECT * FROM \`${table}\` WHERE \`id\` = ?`, [id]);
      }
      await updateTable(table, id, payload, handle);
      return handle.get(`SELECT * FROM \`${table}\` WHERE \`id\` = ?`, [id]);
    },

    deleteById: async (id, handle = db) => {
      const result = await handle.run(`DELETE FROM \`${table}\` WHERE \`id\` = ?`, [id]);
      return result.affectedRows > 0;
    },
  };
};

const WorkflowStepModel = makeCrud('job_workflow_steps', {
  columns: {
    jobId: 'job_id',
    stepNumber: 'step_number',
    stepKey: 'step_key',
    status: 'status',
    findings: 'findings',
    issueTags: 'issue_tags',
    diagnosis: 'diagnosis',
    recommendServiceCenter: 'recommend_service_center',
    checkedInAt: 'checked_in_at',
    completedAt: 'completed_at',
  },
  defaults: { status: 'pending', recommendServiceCenter: 0 },
});

const LiveLocationModel = {
  upsert: async (jobId, latitude, longitude, handle = db) => {
    const timestamp = nowIso();
    const sql = db.driver === 'postgres'
      ? `INSERT INTO job_live_locations (job_id, latitude, longitude, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (job_id) DO UPDATE
           SET latitude = EXCLUDED.latitude,
               longitude = EXCLUDED.longitude,
               updated_at = EXCLUDED.updated_at`
      : db.driver === 'mysql'
        ? `INSERT INTO job_live_locations (job_id, latitude, longitude, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             latitude = VALUES(latitude),
             longitude = VALUES(longitude),
             updated_at = VALUES(updated_at)`
        : `INSERT INTO job_live_locations (job_id, latitude, longitude, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(job_id) DO UPDATE SET
             latitude = excluded.latitude,
             longitude = excluded.longitude,
             updated_at = excluded.updated_at`;
    await handle.run(sql, [jobId, latitude, longitude, timestamp, timestamp]);
    return handle.get('SELECT * FROM job_live_locations WHERE job_id = ?', [jobId]);
  },

  deleteForJob: async (jobId, handle = db) =>
    handle.run('DELETE FROM job_live_locations WHERE job_id = ?', [jobId]),
};

const PartModel = makeCrud('job_parts', {
  columns: {
    jobId: 'job_id',
    partName: 'part_name',
    quantity: 'quantity',
    unitCost: 'unit_cost',
    lineTotal: 'line_total',
  },
  defaults: { quantity: 1, unitCost: 0, lineTotal: 0 },
});

const PhotoModel = makeCrud('job_photos', {
  columns: {
    jobId: 'job_id',
    photoType: 'photo_type',
    fileName: 'file_name',
    fileRef: 'file_ref',
  },
});

const StageHistoryModel = makeCrud('job_stage_history', {
  columns: {
    jobId: 'job_id',
    fromStage: 'from_stage',
    toStage: 'to_stage',
    actorId: 'actor_id',
    note: 'note',
  },
});

const PartnerResponseModel = makeCrud('job_partner_responses', {
  columns: {
    jobId: 'job_id',
    partnerId: 'partner_id',
    response: 'response',
    declineReason: 'decline_reason',
  },
});
PartnerResponseModel.findByPartner = async (partnerId, handle = db) =>
  handle.query(
    `SELECT * FROM \`job_partner_responses\` WHERE \`partner_id\` = ? ORDER BY \`id\` DESC`,
    [partnerId]
  );

const EarningsModel = {
  TABLE: 'earnings',

  findByPartner: async (partnerId, handle = db) =>
    handle.query(`SELECT * FROM \`earnings\` WHERE \`partner_id\` = ? ORDER BY \`id\` DESC`, [
      partnerId,
    ]),

  findByPartnerAndSource: async (partnerId, source, handle = db) =>
    handle.query(
      `SELECT * FROM \`earnings\` WHERE \`partner_id\` = ? AND \`source\` = ? ORDER BY \`id\` DESC`,
      [partnerId, source]
    ),

  findByJob: async (jobId, handle = db) =>
    handle.get(`SELECT * FROM \`earnings\` WHERE \`job_id\` = ?`, [jobId]),

  create: async (data, handle = db) => {
    const id = await insertInto(
      'earnings',
      {
        partner_id: data.partnerId,
        job_id: data.jobId || null,
        source: data.source || 'service',
        gross_amount: data.grossAmount || 0,
        commission: data.commission || 0,
        deductions: data.deductions || 0,
        net_amount: data.netAmount || 0,
        status: data.status || 'pending',
        payout_date: data.payoutDate || null,
        bank_reference: data.bankReference || '',
        created_at: nowIso(),
      },
      handle
    );
    return handle.get(`SELECT * FROM \`earnings\` WHERE \`id\` = ?`, [id]);
  },

  updateById: async (id, updates, handle = db) => {
    const map = {
      grossAmount: 'gross_amount',
      commission: 'commission',
      deductions: 'deductions',
      netAmount: 'net_amount',
      status: 'status',
      payoutDate: 'payout_date',
      bankReference: 'bank_reference',
    };
    const payload = {};
    for (const [key, column] of Object.entries(map)) {
      if (updates[key] !== undefined) payload[column] = updates[key];
    }
    await updateTable('earnings', id, payload, handle);
    return handle.get(`SELECT * FROM \`earnings\` WHERE \`id\` = ?`, [id]);
  },

  toApi: (row) => ({
    id: row.id,
    partnerId: row.partner_id,
    jobId: row.job_id,
    source: row.source,
    grossAmount: row.gross_amount,
    commission: row.commission,
    deductions: row.deductions,
    netAmount: row.net_amount,
    status: row.status,
    payoutDate: row.payout_date,
    bankReference: row.bank_reference,
    createdAt: row.created_at,
  }),
};

const NotificationModel = {
  TABLE: 'notifications',

  findByPartner: async (partnerId, handle = db) =>
    handle.query(
      `SELECT * FROM \`notifications\` WHERE \`partner_id\` = ? ORDER BY \`id\` DESC LIMIT 50`,
      [partnerId]
    ),

  create: async (data, handle = db) => {
    const id = await insertInto(
      'notifications',
      {
        partner_id: data.partnerId,
        job_id: data.jobId || null,
        type: data.type || 'info',
        title: data.title || '',
        body: data.body || '',
        is_read: 0,
        created_at: nowIso(),
      },
      handle
    );
    return handle.get(`SELECT * FROM \`notifications\` WHERE \`id\` = ?`, [id]);
  },

  markRead: async (id, handle = db) => {
    await handle.run(`UPDATE \`notifications\` SET \`is_read\` = 1 WHERE \`id\` = ?`, [id]);
    return handle.get(`SELECT * FROM \`notifications\` WHERE \`id\` = ?`, [id]);
  },
};

const AuditLogModel = {
  TABLE: 'audit_logs',

  findByEntity: async (entity, entityId, handle = db) =>
    handle.query(
      `SELECT * FROM \`audit_logs\` WHERE \`entity\` = ? AND \`entity_id\` = ? ORDER BY \`id\` DESC`,
      [entity, entityId]
    ),

  create: async (data, handle = db) => {
    const id = await insertInto(
      'audit_logs',
      {
        actor_id: data.actorId || null,
        entity: data.entity,
        entity_id: data.entityId || null,
        action: data.action,
        before_state: data.beforeState || null,
        after_state: data.afterState || null,
        ip_address: data.ipAddress || '',
        created_at: nowIso(),
      },
      handle
    );
    return handle.get(`SELECT * FROM \`audit_logs\` WHERE \`id\` = ?`, [id]);
  },
};

const InventoryModel = {
  TABLE: 'inventory_items',

  findByPartner: async (partnerId, handle = db) =>
    handle.query(`SELECT * FROM \`inventory_items\` WHERE \`partner_id\` = ? ORDER BY \`id\``, [
      partnerId,
    ]),

  findById: async (id, handle = db) =>
    handle.get(`SELECT * FROM \`inventory_items\` WHERE \`id\` = ?`, [id]),

  create: async (data, handle = db) => {
    const id = await insertInto(
      'inventory_items',
      {
        partner_id: data.partnerId,
        name: data.name,
        sku: data.sku || '',
        category: data.category || '',
        quantity: data.quantity || 0,
        reorder_level: data.reorderLevel || 0,
        unit_cost: data.unitCost || 0,
        created_at: nowIso(),
        updated_at: nowIso(),
      },
      handle
    );
    return handle.get(`SELECT * FROM \`inventory_items\` WHERE \`id\` = ?`, [id]);
  },

  updateById: async (id, updates, handle = db) => {
    const map = {
      name: 'name',
      sku: 'sku',
      category: 'category',
      quantity: 'quantity',
      reorderLevel: 'reorder_level',
      unitCost: 'unit_cost',
    };
    const payload = { updated_at: nowIso() };
    for (const [key, column] of Object.entries(map)) {
      if (updates[key] !== undefined) payload[column] = updates[key];
    }
    await updateTable('inventory_items', id, payload, handle);
    return handle.get(`SELECT * FROM \`inventory_items\` WHERE \`id\` = ?`, [id]);
  },
};

const DeliveryVerificationModel = {
  TABLE: 'delivery_verifications',

  findByUser: async (userId, handle = db) =>
    handle.get(
      `SELECT * FROM \`delivery_verifications\` WHERE \`user_id\` = ? ORDER BY \`id\` DESC LIMIT 1`,
      [userId]
    ),

  create: async (data, handle = db) => {
    const id = await insertInto(
      'delivery_verifications',
      {
        user_id: data.userId,
        vehicle_type: data.vehicleType,
        vehicle_number: data.vehicleNumber,
        license_document_id: data.licenseDocumentId || null,
        status: 'pending',
        created_at: nowIso(),
        updated_at: nowIso(),
      },
      handle
    );
    return handle.get(`SELECT * FROM \`delivery_verifications\` WHERE \`id\` = ?`, [id]);
  },

  toApi: (row) => row && ({
    id: row.id,
    userId: row.user_id,
    vehicleType: row.vehicle_type,
    vehicleNumber: row.vehicle_number,
    licenseDocumentId: row.license_document_id,
    status: row.status,
    createdAt: row.created_at,
  }),
};

module.exports = {
  WorkflowStepModel,
  LiveLocationModel,
  PartModel,
  PhotoModel,
  StageHistoryModel,
  PartnerResponseModel,
  EarningsModel,
  NotificationModel,
  AuditLogModel,
  InventoryModel,
  DeliveryVerificationModel,
};
