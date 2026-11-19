const { db, nowIso } = require('../../db/energy_provider/index');
const { insertInto, updateTable, parseJson, touch } = require('./helpers');

const decodeEncodedJson = (value) => {
  if (typeof value === 'string') {
    try { return JSON.parse(value); } catch { return value; }
  }
  return value;
};

const normalizeSpecializations = (value) => {
  let parsed = decodeEncodedJson(value);
  const decodeIndexedObject = (candidate) => {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return candidate;
    const keys = Object.keys(candidate);
    if (!keys.length || !keys.every((key) => /^\d+$/.test(key))) return candidate;
    return decodeEncodedJson(keys.sort((left, right) => Number(left) - Number(right)).map((key) => candidate[key]).join(''));
  };
  for (let depth = 0; depth < 4 && parsed && typeof parsed === 'object' && !Array.isArray(parsed); depth += 1) {
    parsed = decodeIndexedObject(parsed);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) break;
    if (typeof parsed.specializations === 'string' || (parsed.specializations && typeof parsed.specializations === 'object')) {
      parsed = decodeEncodedJson(parsed.specializations);
      continue;
    }
    if (typeof parsed.approvedCategories === 'string') {
      const approved = decodeEncodedJson(parsed.approvedCategories);
      if (approved && typeof approved === 'object') parsed.approvedCategories = approved;
    }
    if (typeof parsed.approvedProfileCategories === 'string') {
      const approvedProfile = decodeEncodedJson(parsed.approvedProfileCategories);
      if (approvedProfile && typeof approvedProfile === 'object') parsed.approvedProfileCategories = approvedProfile;
    }
    break;
  }
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
};

const TABLE = 'partner_applications';

const RegistrationModel = {
  TABLE,

  findById: async (id, handle = db) =>
    handle.get(`SELECT * FROM \`${TABLE}\` WHERE \`id\` = ?`, [id]),

  findByMobile: async (mobile, handle = db) =>
    handle.query(`SELECT * FROM \`${TABLE}\` WHERE \`mobile\` = ? ORDER BY \`id\` DESC`, [mobile]),

  findLatestByUser: async (userId, handle = db) =>
    handle.get(
      `SELECT * FROM \`${TABLE}\` WHERE \`user_id\` = ? ORDER BY \`id\` DESC LIMIT 1`,
      [userId]
    ),

  findLatestByUserAndRole: async (userId, role, handle = db) =>
    handle.get(
      `SELECT * FROM \`${TABLE}\` WHERE \`user_id\` = ? AND \`partner_role\` = ? ORDER BY \`id\` DESC LIMIT 1`,
      [userId, role]
    ),

  /** Most recent draft application, optionally filtered to a partner role. */
  findUnsubmittedByMobile: async (mobile, role, handle = db) =>
    handle.get(
      `SELECT * FROM \`${TABLE}\` WHERE \`mobile\` = ? AND \`status\` = 'draft'${role ? ' AND \`partner_role\` = ?' : ''} ORDER BY \`id\` DESC LIMIT 1`,
      role ? [mobile, role] : [mobile]
    ),

  findAll: async (handle = db) => handle.query(`SELECT * FROM \`${TABLE}\` ORDER BY \`id\``),

  findPendingSpecializationReviews: async (handle = db) =>
    handle.query(
      `SELECT * FROM \`${TABLE}\` WHERE \`specialization_status\` = 'pending' ORDER BY \`updated_at\` DESC, \`id\` DESC`
    ),

  create: async (regData, handle = db) => {
    const id = await insertInto(
      TABLE,
      {
        user_id: regData.userId || null,
        account_group_id: regData.accountGroupId || regData.userId || null,
        mobile: regData.mobile,
        email: regData.email || '',
        partner_role: regData.role || regData.partnerRole || null,
        status: regData.status || 'draft',
        current_step: regData.currentStep || 0,
        created_at: nowIso(),
        updated_at: nowIso(),
      },
      handle
    );
    return RegistrationModel.findById(id, handle);
  },

  updateById: async (id, updates, handle = db) => {
    const payload = { ...updates };
    if ('role' in updates) {
      payload.partner_role = updates.role;
      delete payload.role;
    }
    if ('userId' in updates) {
      payload.user_id = updates.userId;
      delete payload.userId;
    }
    if ('accountGroupId' in updates) {
      payload.account_group_id = updates.accountGroupId;
      delete payload.accountGroupId;
    }
    Object.assign(payload, touch());
    await updateTable(TABLE, id, payload, handle);
    return RegistrationModel.findById(id, handle);
  },

  deleteById: async (id, handle = db) => {
    const result = await handle.run(`DELETE FROM \`${TABLE}\` WHERE \`id\` = ?`, [id]);
    return result.affectedRows > 0;
  },

  /** Shape the row for API responses (JSON columns decoded). */
  toApi: (row) => {
    if (!row) return null;
    return {
      id: row.id,
      userId: row.user_id,
      accountGroupId: row.account_group_id || row.user_id,
      mobile: row.mobile,
      email: row.email,
      partnerRole: row.partner_role,
      status: row.status,
      currentStep: row.current_step,
      personalDetails: parseJson(row.personal_details, null),
      professionalDetails: parseJson(row.professional_details, null),
      bankDetails: parseJson(row.bank_details, null),
      serviceAreas: row.service_areas,
      travelRadiusKm: row.travel_radius_km,
      categories: parseJson(row.categories, []),
      specializations: normalizeSpecializations(row.specializations),
      specializationStatus: row.specialization_status || 'unsubmitted',
      consent: !!row.consent,
      rejectionReason: row.rejection_reason,
      referenceId: row.reference_id,
      submittedAt: row.submitted_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  },
};

module.exports = RegistrationModel;
