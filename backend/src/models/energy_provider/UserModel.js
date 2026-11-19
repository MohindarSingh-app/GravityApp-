const { db, nowIso } = require('../../db/energy_provider/index');
const { insertInto, updateTable, touch } = require('./helpers');

const TABLE = 'users';

const UserModel = {
  TABLE,

  findById: async (id, handle = db) =>
    handle.get(`SELECT * FROM \`${TABLE}\` WHERE \`id\` = ?`, [id]),

  findByMobile: async (mobile, handle = db) =>
    handle.get(
      `SELECT * FROM \`${TABLE}\` WHERE \`mobile\` = ? ORDER BY CASE WHEN \`status\` = 'approved' THEN 0 ELSE 1 END, \`id\` LIMIT 1`,
      [mobile]
    ),

  findByEmail: async (email, handle = db) =>
    handle.get(`SELECT * FROM \`${TABLE}\` WHERE \`email\` = ?`, [email]),

  findByRole: async (role, handle = db) =>
    handle.query(`SELECT * FROM \`${TABLE}\` WHERE \`role\` = ?`, [role]),

  nextAccountId: async (handle = db) => {
    const result = await handle.get(`SELECT COALESCE(MAX(\`id\`), 0) + 1 AS next_id FROM \`${TABLE}\``);
    return Number(result.next_id);
  },

  findRoleAccounts: async (mobile, handle = db) =>
    handle.query(
      `SELECT * FROM \`${TABLE}\` WHERE COALESCE(\`account_group_id\`, \`id\`) = (SELECT COALESCE(\`account_group_id\`, \`id\`) FROM \`${TABLE}\` WHERE \`mobile\` = ? ORDER BY \`id\` LIMIT 1) AND \`role\` <> 'admin' ORDER BY CASE WHEN \`status\` = 'approved' THEN 0 ELSE 1 END, \`id\``,
      [mobile]
    ),

  findAll: async (handle = db) => handle.query(`SELECT * FROM \`${TABLE}\` ORDER BY \`id\``),

  /** Partners that are approved, online and not busy - the only ones that can
   *  be offered a job. */
  findAvailable: async (role, handle = db) =>
    handle.query(
      `SELECT * FROM \`${TABLE}\`
        WHERE \`role\` = ?
          AND \`status\` = 'approved'
          AND \`is_online\` = 1
          AND \`is_busy\` = 0`,
      [role]
    ),

  create: async (userData, handle = db) => {
    const id = await insertInto(
      TABLE,
      {
        mobile: userData.mobile,
        email: userData.email || '',
        role: userData.role || null,
        account_group_id: userData.accountGroupId || null,
        status: userData.status || 'pending',
        specialization_status: userData.specializationStatus || 'unsubmitted',
        full_name: userData.fullName || userData.full_name || '',
        business_name: userData.businessName || userData.business_name || '',
        created_at: nowIso(),
        updated_at: nowIso(),
      },
      handle
    );
    return UserModel.findById(id, handle);
  },

  updateById: async (id, updates, handle = db) => {
    const payload = { ...updates };
    if ('fullName' in updates) {
      payload.full_name = updates.fullName;
      delete payload.fullName;
    }
    if ('businessName' in updates) {
      payload.business_name = updates.businessName;
      delete payload.businessName;
    }
    if ('specializationStatus' in updates) {
      payload.specialization_status = updates.specializationStatus;
      delete payload.specializationStatus;
    }
    if ('specializationDetails' in updates) {
      payload.specialization_details = updates.specializationDetails;
      delete payload.specializationDetails;
    }
    if ('qualificationDetails' in updates) {
      payload.qualification_details = updates.qualificationDetails;
      delete payload.qualificationDetails;
    }
    if ('serviceAreaDetails' in updates) {
      payload.service_area_details = updates.serviceAreaDetails;
      delete payload.serviceAreaDetails;
    }
    Object.assign(payload, touch());
    await updateTable(TABLE, id, payload, handle);
    return UserModel.findById(id, handle);
  },

  /** Atomic "set busy only if currently not busy" guard. */
  setBusy: async (id, busy, handle = db) => {
    const result = await handle.run(
      `UPDATE \`${TABLE}\` SET \`is_busy\` = ?, \`updated_at\` = ? WHERE \`id\` = ? AND \`is_busy\` = ?`,
      [busy ? 1 : 0, nowIso(), id, busy ? 1 : 0]
    );
    return result.affectedRows > 0;
  },

  setOnline: async (id, online, handle = db) => {
    await handle.run(
      `UPDATE \`${TABLE}\` SET \`is_online\` = ?, \`updated_at\` = ? WHERE \`id\` = ?`,
      [online ? 1 : 0, nowIso(), id]
    );
    return UserModel.findById(id, handle);
  },

  deleteById: async (id, handle = db) => {
    const result = await handle.run(`DELETE FROM \`${TABLE}\` WHERE \`id\` = ?`, [id]);
    return result.affectedRows > 0;
  },
};

module.exports = UserModel;

