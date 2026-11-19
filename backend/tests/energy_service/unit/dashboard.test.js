const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { pool } = require('../../../src/config/energy_service/db');
const { accessFor } = require('../../../src/services/energy_service/dashboard.service');

after(async () => {
  await pool.end();
});

test('dashboard access follows the role map', () => {
  const owner = accessFor('DIRECTOR_OWNER');
  assert.equal(owner.updateCompany, true);
  assert.equal(owner.readPeople, true);
  assert.equal(owner.readApiKeys, true);
  assert.equal(owner.createSites, true);

  const head = accessFor('MAINTENANCE_HEAD');
  assert.equal(head.updateCompany, true);
  assert.equal(head.readApiKeys, true);
  assert.equal(head.managePeople, true);

  const purchase = accessFor('PURCHASE_MGR');
  assert.equal(purchase.readPeople, true);
  assert.equal(purchase.createSites, true);
  assert.equal(purchase.updateSites, true);
  assert.equal(purchase.updateCompany, false);
  assert.equal(purchase.readApiKeys, false);
  assert.equal(purchase.deleteSites, false);
  assert.equal(purchase.readMarketplace, true);
  assert.equal(purchase.quoteAmc, true);
  assert.equal(purchase.updateJobs, false);

  const engineer = accessFor('SITE_ENGINEER');
  assert.equal(engineer.readSites, true);
  assert.equal(engineer.readMarketplace, false);
  assert.equal(engineer.createRepairs, false);
  assert.equal(engineer.updateJobs, true);
  assert.equal(engineer.quoteAmc, false);
});
