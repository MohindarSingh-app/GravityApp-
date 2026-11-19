/**
 * Small helpers shared by every model.
 */

const { db, nowIso } = require('../../db/energy_provider/index');

/**
 * Build an INSERT statement from a plain object.
 * Column names are taken verbatim (they are internal constants, never user
 * input) while every value is bound as a parameter.
 */
const insertInto = async (table, data, handle = db) => {
  const keys = Object.keys(data).filter((key) => data[key] !== undefined);
  if (!keys.length) throw new Error(`insertInto(${table}) called without columns`);

  const placeholders = keys.map(() => '?').join(', ');
  const sql = `INSERT INTO \`${table}\` (${keys
    .map((key) => `\`${key}\``)
    .join(', ')}) VALUES (${placeholders})`;
  const result = await handle.run(sql, keys.map((key) => data[key]));
  return result.insertId;
};

/**
 * Build an UPDATE statement from a plain object.  Returns the number of
 * affected rows so callers can detect optimistic-concurrency failures.
 */
const updateTable = async (table, id, data, handle = db) => {
  const keys = Object.keys(data).filter((key) => data[key] !== undefined);
  if (!keys.length) return 0;

  const assignments = keys.map((key) => `\`${key}\` = ?`).join(', ');
  const sql = `UPDATE \`${table}\` SET ${assignments} WHERE \`id\` = ?`;
  const result = await handle.run(sql, [...keys.map((key) => data[key]), id]);
  return result.affectedRows;
};

/** JSON columns are stored as text; this converts them back. */
const parseJson = (value, fallback = null) => {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch (err) {
    return fallback;
  }
};

const touch = () => ({ updated_at: nowIso() });

module.exports = { insertInto, updateTable, parseJson, touch, nowIso };
