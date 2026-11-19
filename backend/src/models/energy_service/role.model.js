const { pool } = require('../../config/energy_service/db');

function db(client) {
  return client || pool;
}

const COLUMNS = `id, name, description, status, created_at, updated_at`;

async function findByName(name, client) {
  const result = await db(client).query(
    `SELECT ${COLUMNS} FROM roles WHERE name = $1`,
    [name],
  );
  return result.rows[0] || null;
}

async function findById(id, client) {
  const result = await db(client).query(
    `SELECT ${COLUMNS} FROM roles WHERE id = $1`,
    [id],
  );
  return result.rows[0] || null;
}

async function list(client) {
  const result = await db(client).query(
    `SELECT ${COLUMNS} FROM roles ORDER BY name`,
  );
  return result.rows;
}

async function update(id, { description, status }, client) {
  const result = await db(client).query(
    `UPDATE roles
     SET description = COALESCE($2, description),
         status = COALESCE($3, status)
     WHERE id = $1
     RETURNING ${COLUMNS}`,
    [id, description === undefined ? null : description, status || null],
  );
  return result.rows[0] || null;
}

module.exports = {
  findByName,
  findById,
  list,
  update,
};
