const { Client } = require('pg');

const TARGET_DB = (process.env.DB_NAME || 'energy_hub').trim() || 'energy_hub';
const TARGET_DB_IDENTIFIER = quoteIdent(TARGET_DB);
const SERVICE_SOURCE = 'ZypliserviceApp';
const PROVIDER_SOURCE = 'Energy_hub_0.66E';

function baseConfig(database) {
  return {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database,
  };
}

function databaseUrl() {
  const user = encodeURIComponent(process.env.DB_USER || 'postgres');
  const password = encodeURIComponent(process.env.DB_PASSWORD || '');
  const host = process.env.DB_HOST || '127.0.0.1';
  const port = process.env.DB_PORT || 5432;
  return `postgresql://${user}:${password}@${host}:${port}/${TARGET_DB}`;
}

async function ensureUnifiedDatabase() {
  const admin = new Client(baseConfig('postgres'));
  await admin.connect();
  const existing = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [TARGET_DB]);
  if (!existing.rowCount) {
    const source = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [SERVICE_SOURCE]);
    if (source.rowCount) {
      await admin.query(
        'SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()',
        [SERVICE_SOURCE]
      );
      await admin.query(`CREATE DATABASE ${TARGET_DB} TEMPLATE "${SERVICE_SOURCE}"`);
      console.log(`Created ${TARGET_DB} from ${SERVICE_SOURCE}`);
    } else {
      await admin.query(`CREATE DATABASE ${TARGET_DB_IDENTIFIER}`);
      console.log(`Created empty database ${TARGET_DB}`);
    }
  }
  await admin.end();

  process.env.DATABASE_URL = databaseUrl();
  const app = new Client(baseConfig(TARGET_DB));
  await app.connect();
  await app.query('CREATE SCHEMA IF NOT EXISTS energy_provider');
  await app.query(`
    CREATE TABLE IF NOT EXISTS website_contacts (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      subject TEXT,
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'new',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await app.query(`
    CREATE TABLE IF NOT EXISTS superadmins (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'superadmin',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await app.end();
}

function quoteIdent(name) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    throw new Error(`Unsafe identifier: ${name}`);
  }
  return `"${name}"`;
}

function cell(value) {
  if (value === undefined) return null;
  if (value === null || value instanceof Date || Buffer.isBuffer(value)) return value;
  if (typeof value === 'object') return JSON.stringify(value);
  return value;
}

async function copyProviderData() {
  const source = new Client(baseConfig(PROVIDER_SOURCE));
  try {
    await source.connect();
  } catch (error) {
    console.log(`Provider data was not copied: ${error.message}`);
    return;
  }

  const target = new Client({
    ...baseConfig(TARGET_DB),
    options: '-c search_path=energy_provider',
  });
  await target.connect();
  try {
    await target.query("SET session_replication_role = 'replica'");
  } catch (_error) {
    // A non-superuser can still copy when the insert order satisfies foreign keys.
  }

  const { rows: tables } = await source.query(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename"
  );

  for (const { tablename } of tables) {
    try {
      const present = await target.query(
        `SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'energy_provider' AND table_name = $1`,
        [tablename]
      );
      if (!present.rowCount) continue;
      const count = await target.query(`SELECT COUNT(*)::int AS n FROM ${quoteIdent(tablename)}`);
      if (count.rows[0].n > 0) continue;

      const data = await source.query(`SELECT * FROM public.${quoteIdent(tablename)}`);
      if (!data.rows.length) continue;
      const columnsResult = await target.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_schema = 'energy_provider' AND table_name = $1`,
        [tablename]
      );
      const allowed = new Set(columnsResult.rows.map((row) => row.column_name));
      const columns = data.fields.map((field) => field.name).filter((name) => allowed.has(name));
      const columnSql = columns.map(quoteIdent).join(', ');

      for (const row of data.rows) {
        const values = columns.map((name) => cell(row[name]));
        const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');
        await target.query(
          `INSERT INTO ${quoteIdent(tablename)} (${columnSql}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
          values
        );
      }
      await target.query(
        `SELECT setval(pg_get_serial_sequence($1, 'id'), GREATEST((SELECT COALESCE(MAX(id), 1) FROM ${quoteIdent(tablename)}), 1), true)`,
        [`energy_provider.${tablename}`]
      ).catch(() => {});
      console.log(`Copied ${data.rows.length} rows into energy_provider.${tablename}`);
    } catch (error) {
      console.log(`Skipped energy_provider.${tablename}: ${error.message}`);
    }
  }

  await source.end();
  await target.end();
}

module.exports = { ensureUnifiedDatabase, copyProviderData, TARGET_DB };
