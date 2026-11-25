const { test } = require('node:test');
const assert = require('node:assert/strict');
const marketplaceSync = require('./marketplace-sync.service');
const JobModel = require('../../models/energy_provider/JobModel');

function withUnifiedServer(fn) {
  const previous = process.env.UNIFIED_SERVER;
  process.env.UNIFIED_SERVER = '1';
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      if (previous === undefined) delete process.env.UNIFIED_SERVER;
      else process.env.UNIFIED_SERVER = previous;
    });
}

test('service jobs map catalog codes to Energy Hub specializations', () => {
  assert.equal(marketplaceSync.marketplaceCategory('plc'), 'PLC / Automation');
  assert.equal(marketplaceSync.marketplaceCategory('unmapped'), 'Electrical');
});

test('publishing a service job creates a marketplace service request without customer phone data', async () => {
  await withUnifiedServer(async () => {
    const calls = [];
    const client = {
      query: async (sql, values) => {
        calls.push({ sql, values });
        if (sql.includes('FROM companies')) {
          return { rows: [{ company_name: 'Example Plant', city: 'Pune' }] };
        }
        if (sql.includes('FROM sites')) {
          return { rows: [{ address: 'Industrial Road', city: 'Pune', state: 'MH', pincode: '411001' }] };
        }
        return { rows: [], rowCount: 1 };
      },
    };

    const published = await marketplaceSync.publishJob(client, {
      job: { code: 'EC-AB12CD34', title: 'PLC repair', created_at: new Date(), sla_due_at: new Date() },
      companyId: 'company-1',
      siteId: 'site-1',
      input: { catalogCode: 'plc', notes: 'Inspect the controller' },
      priority: 'emergency',
    });

    assert.equal(published, true);
    const insert = calls[2];
    assert.match(insert.sql, /INSERT INTO energy_provider\.jobs/);
    assert.deepEqual(insert.values.slice(0, 7), [
      'SA-EC-AB12CD34',
      'PLC repair',
      'Inspect the controller',
      'PLC / Automation',
      '["PLC / Automation"]',
      'urgent',
      'Example Plant',
    ]);
    assert.equal(insert.values[7], 'Industrial Road, Pune, MH, 411001');
  });
});

test('Energy Hub partner status is mirrored onto the linked Service Admin job', async () => {
  await withUnifiedServer(async () => {
    let query;
    const handle = {
      run: async (sql, values) => {
        query = { sql, values };
        return { affectedRows: 1 };
      },
    };

    await JobModel.syncServiceStatus(
      { reference_id: 'SA-EC-AB12CD34', status: 'accepted' },
      handle,
      { full_name: 'Alex Partner', role: 'service_partner', rating: 4.8 },
    );

    assert.match(query.sql, /UPDATE public\.field_jobs/);
    assert.deepEqual(query.values, [
      'accepted',
      'Alex Partner',
      'Energy Hub Service Partner',
      4.8,
      'EC-AB12CD34',
    ]);
  });
});

test('service cannot cancel a published request after an Energy Hub partner claims it', async () => {
  await withUnifiedServer(async () => {
    const client = {
      query: async () => ({ rowCount: 0, rows: [] }),
    };

    await assert.rejects(
      marketplaceSync.cancelUnclaimedJob(client, 'EC-AB12CD34'),
      { code: 'MARKETPLACE_JOB_CLAIMED', statusCode: 409 },
    );
  });
});
