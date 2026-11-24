const test = require('node:test');
const assert = require('node:assert/strict');

const configPath = require.resolve('../../../src/config/database');

function loadConfig(dbName) {
  const previous = process.env.DB_NAME;
  if (dbName === undefined) delete process.env.DB_NAME;
  else process.env.DB_NAME = dbName;
  delete require.cache[configPath];

  try {
    return require(configPath);
  } finally {
    delete require.cache[configPath];
    if (previous === undefined) delete process.env.DB_NAME;
    else process.env.DB_NAME = previous;
  }
}

test('database target uses DB_NAME and defaults to energy_hub', () => {
  assert.equal(loadConfig('GravityHub_App').TARGET_DB, 'GravityHub_App');
  assert.equal(loadConfig(undefined).TARGET_DB, 'energy_hub');
});

test('database target rejects unsafe PostgreSQL identifiers', () => {
  assert.throws(() => loadConfig('GravityHub_App; DROP DATABASE postgres'), /Unsafe identifier/);
});
