const { Pool } = require('pg');

let pool;

function db() {
  if (!pool) pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
  return pool;
}

function present(row) {
  if (!row) return null;
  return {
    _id: row.id,
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    subject: row.subject,
    message: row.message,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function create(input) {
  const { rows } = await db().query(
    `INSERT INTO website_contacts (name, email, phone, subject, message)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [input.name, input.email, input.phone || null, input.subject || null, input.message]
  );
  return present(rows[0]);
}

async function find() {
  const { rows } = await db().query(
    'SELECT * FROM website_contacts ORDER BY created_at DESC'
  );
  return {
    sort() {
      return rows.map(present);
    },
  };
}

module.exports = { create, find };
