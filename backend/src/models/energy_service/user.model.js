const { pool } = require('../../config/energy_service/db');

function db(client) {
  return client || pool;
}

const COLUMNS = `
  u.id, u.company_id, u.role_id, u.name, u.email, u.phone, u.secondary_phone, u.password_hash,
  u.email_verified, u.phone_verified, u.status, u.avatar_url, u.last_login_at,
  ARRAY(SELECT cm.company_id FROM company_members cm WHERE cm.user_id = u.id) AS company_ids,
  u.created_at, u.updated_at, r.name AS role, r.status AS role_status
`;

const FROM_USER = `
  FROM users u
  JOIN roles r ON r.id = u.role_id
`;

async function findByEmail(email, client) {
  const result = await db(client).query(
    `SELECT ${COLUMNS} ${FROM_USER} WHERE u.email = $1`,
    [email],
  );
  return result.rows[0] || null;
}

async function findByPhone(phone, client) {
  const result = await db(client).query(
    `SELECT ${COLUMNS} ${FROM_USER} WHERE u.phone = $1`,
    [phone],
  );
  return result.rows[0] || null;
}

async function findById(id, client) {
  const result = await db(client).query(
    `SELECT ${COLUMNS} ${FROM_USER} WHERE u.id = $1`,
    [id],
  );
  return result.rows[0] || null;
}

async function listByCompany(companyId, client) {
  const result = await db(client).query(
    `SELECT ${COLUMNS}
     FROM users u
     JOIN roles r ON r.id = u.role_id
     JOIN company_members cm ON cm.user_id = u.id
     WHERE cm.company_id = $1
     ORDER BY u.created_at ASC`,
    [companyId],
  );
  return result.rows;
}

async function create({
  email, passwordHash, name, phone, roleId, companyId, status, emailVerified, phoneVerified,
}, client) {
  const result = await db(client).query(
    `INSERT INTO users (
       email, password_hash, name, phone, role_id, company_id, status, email_verified, phone_verified
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id`,
    [
      email || null,
      passwordHash || null,
      name || null,
      phone || null,
      roleId,
      companyId || null,
      status || 'active',
      Boolean(emailVerified),
      Boolean(phoneVerified),
    ],
  );
  return findById(result.rows[0].id, client);
}

async function updateProfile(id, { name, email, phone, avatarUrl, secondaryPhone }, client) {
  const result = await db(client).query(
    `UPDATE users
     SET name = COALESCE($2, name),
         email = COALESCE($3, email),
         phone = COALESCE($4, phone),
         avatar_url = COALESCE($5, avatar_url),
         secondary_phone = CASE WHEN $6 THEN $7 ELSE secondary_phone END
     WHERE id = $1
     RETURNING id`,
    [
      id,
      name === undefined ? null : name,
      email === undefined ? null : email,
      phone === undefined ? null : phone,
      avatarUrl === undefined ? null : avatarUrl,
      secondaryPhone !== undefined,
      secondaryPhone === undefined ? null : secondaryPhone,
    ],
  );
  if (!result.rows[0]) return null;
  return findById(id, client);
}

async function updatePassword(id, passwordHash, client) {
  await db(client).query(
    `UPDATE users SET password_hash = $2 WHERE id = $1`,
    [id, passwordHash],
  );
}

async function setEmailVerified(id, client) {
  await db(client).query(
    `UPDATE users SET email_verified = TRUE WHERE id = $1`,
    [id],
  );
}

async function setPhoneVerified(id, client) {
  await db(client).query(
    `UPDATE users SET phone_verified = TRUE WHERE id = $1`,
    [id],
  );
}

async function setCompany(id, companyId, client) {
  await db(client).query(
    `INSERT INTO company_members (company_id, user_id)
     VALUES ($2, $1)
     ON CONFLICT (company_id, user_id) DO NOTHING`,
    [id, companyId],
  );
  return setActiveCompany(id, companyId, client);
}

async function setActiveCompany(id, companyId, client) {
  const result = await db(client).query(
    `UPDATE users
     SET company_id = $2
     WHERE id = $1
       AND EXISTS (
         SELECT 1 FROM company_members
         WHERE user_id = $1 AND company_id = $2
       )
     RETURNING id`,
    [id, companyId],
  );
  if (!result.rows[0]) return null;
  return findById(id, client);
}

async function setRole(id, roleId, client) {
  const result = await db(client).query(
    `UPDATE users SET role_id = $2 WHERE id = $1 RETURNING id`,
    [id, roleId],
  );
  if (!result.rows[0]) return null;
  return findById(id, client);
}

async function setStatus(id, status, client) {
  const result = await db(client).query(
    `UPDATE users SET status = $2 WHERE id = $1 RETURNING id`,
    [id, status],
  );
  if (!result.rows[0]) return null;
  return findById(id, client);
}

async function touchLastLogin(id, client) {
  await db(client).query(
    `UPDATE users SET last_login_at = NOW() WHERE id = $1`,
    [id],
  );
}

module.exports = {
  findByEmail,
  findByPhone,
  findById,
  listByCompany,
  create,
  updateProfile,
  updatePassword,
  setEmailVerified,
  setPhoneVerified,
  setCompany,
  setActiveCompany,
  setRole,
  setStatus,
  touchLastLogin,
};
