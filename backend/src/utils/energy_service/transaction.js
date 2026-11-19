const { pool } = require('../../config/energy_service/db');

async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (_rollbackError) {
      // Preserve the original error when the transaction is already closed.
    }
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { withTransaction };
