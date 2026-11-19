const { pool } = require('../../../config/energy_service/db');

function db(client) {
  return client || pool;
}

function likePattern(value) {
  return `%${String(value).replace(/[\\%_]/g, '\\$&')}%`;
}

function addEq(where, values, column, value) {
  if (value === undefined || value === null || value === '') return;
  values.push(value);
  where.push(`${column} = $${values.length}`);
}

function addLike(where, values, columns, q) {
  if (!q) return;
  values.push(likePattern(q));
  const idx = values.length;
  where.push(`(${columns.map((column) => `${column} ILIKE $${idx} ESCAPE '\\'`).join(' OR ')})`);
}

async function selectPaged(runner, { select, from, where, values, order, limit, offset }) {
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const count = await runner.query(
    `SELECT COUNT(*)::int AS count FROM ${from} ${whereSql}`,
    values,
  );
  const rows = await runner.query(
    `SELECT ${select}
     FROM ${from}
     ${whereSql}
     ORDER BY ${order}
     LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
    values.concat([limit, offset]),
  );
  return { rows: rows.rows, total: count.rows[0].count };
}

module.exports = {
  db,
  likePattern,
  addEq,
  addLike,
  selectPaged,
};
