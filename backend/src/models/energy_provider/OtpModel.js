const { db, nowIso } = require('../../db/energy_provider/index');
const { insertInto } = require('./helpers');

const TABLE = 'otp_codes';

const OtpModel = {
  TABLE,

  findLatestForMobile: async (mobile, handle = db) =>
    handle.get(
      `SELECT * FROM \`${TABLE}\` WHERE \`mobile\` = ? ORDER BY \`id\` DESC LIMIT 1`,
      [mobile]
    ),

  create: async (mobile, otpData, handle = db) => {
    const id = await insertInto(
      TABLE,
      {
        mobile,
        code: otpData.otp,
        purpose: otpData.purpose || 'login',
        email: otpData.email || '',
        attempts: 0,
        expires_at: new Date(Date.now() + otpData.ttlMs).toISOString(),
        created_at: nowIso(),
      },
      handle
    );
    return OtpModel.findById(id, handle);
  },

  findById: async (id, handle = db) =>
    handle.get(`SELECT * FROM \`${TABLE}\` WHERE \`id\` = ?`, [id]),

  incrementAttempts: async (id, handle = db) => {
    await handle.run(`UPDATE \`${TABLE}\` SET \`attempts\` = \`attempts\` + 1 WHERE \`id\` = ?`, [
      id,
    ]);
    return OtpModel.findById(id, handle);
  },

  consume: async (id, handle = db) => {
    await handle.run(
      `UPDATE \`${TABLE}\` SET \`consumed_at\` = ? WHERE \`id\` = ?`,
      [nowIso(), id]
    );
  },

  deleteByMobile: async (mobile, handle = db) => {
    const result = await handle.run(`DELETE FROM \`${TABLE}\` WHERE \`mobile\` = ?`, [mobile]);
    return result.affectedRows;
  },

  purgeExpired: async (handle = db) => {
    const result = await handle.run(
      `DELETE FROM \`${TABLE}\` WHERE \`expires_at\` < ?`,
      [nowIso()]
    );
    return result.affectedRows;
  },
};

module.exports = OtpModel;

