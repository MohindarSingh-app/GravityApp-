const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { pool } = require('../../../src/config/energy_service/db');
const fieldModel = require('../../../src/models/energy_service/field.model');
const amcModel = require('../../../src/models/energy_service/customer/amc.model');
const fieldService = require('../../../src/services/energy_service/field.service');
const siteModel = require('../../../src/models/energy_service/site.model');
const attachmentModel = require('../../../src/models/energy_service/customer/attachment.model');

after(async () => {
  await pool.end();
});

test('latestOpenSignals returns the newest open row for each requested kind', async () => {
  let queryText;
  let queryValues;
  const client = {
    query: async (text, values) => {
      queryText = text;
      queryValues = values;
      return {
        rows: [
          { kind: 'emergency', id: 'emergency-new' },
          { kind: 'transit', id: 'transit-new' },
        ],
      };
    },
  };

  const result = await fieldModel.latestOpenSignals('company-1', ['emergency', 'transit'], client);

  assert.match(queryText, /DISTINCT ON \(s\.kind\)/);
  assert.match(queryText, /LEFT JOIN devices d/);
  assert.match(queryText, /d\.power_rating/);
  assert.deepEqual(queryValues, ['company-1', ['emergency', 'transit']]);
  assert.deepEqual(result, {
    emergency: { kind: 'emergency', id: 'emergency-new' },
    transit: { kind: 'transit', id: 'transit-new' },
  });
});

test('active AMC count is read from active company contracts', async () => {
  let queryText;
  let queryValues;
  const client = {
    query: async (text, values) => {
      queryText = text;
      queryValues = values;
      return { rows: [{ active: 2 }] };
    },
  };

  const count = await amcModel.countActiveContracts('company-1', client);

  assert.equal(count, 2);
  assert.match(queryText, /FROM amc_contracts/);
  assert.match(queryText, /status = 'active'/);
  assert.deepEqual(queryValues, ['company-1']);
});

test('dashboard snapshot limits each burst to three simultaneous database reads', async () => {
  const originalFieldMethods = {};
  const originalCountActiveContracts = amcModel.countActiveContracts;
  const originalListByCompany = siteModel.listByCompany;
  const fieldMethods = {
    listJobs: async () => [],
    countJobs: async () => ({ active: 0, sla_risk: 0 }),
    latestOpenSignals: async () => ({}),
    listAmc: async () => [{ id: 'plan-1', status: 'active' }],
    listCerts: async () => [],
    listCatalog: async () => [],
    listSpares: async () => [],
  };
  let inFlight = 0;
  let peakInFlight = 0;

  Object.entries(fieldMethods).forEach(([name, implementation]) => {
    originalFieldMethods[name] = fieldModel[name];
    fieldModel[name] = async (...args) => {
      inFlight += 1;
      peakInFlight = Math.max(peakInFlight, inFlight);
      try {
        await new Promise((resolve) => setTimeout(resolve, 2));
        return await implementation(...args);
      } finally {
        inFlight -= 1;
      }
    };
  });
  amcModel.countActiveContracts = async () => 2;
  siteModel.listByCompany = async () => [];

  try {
    const snapshot = await fieldService.snapshot(
      { company_id: 'company-1' },
      { readMarketplace: true, createRepairs: true },
    );
    assert.equal(snapshot.metrics.amcActive, 2);
    assert.equal(snapshot.amc.active, 2);
  } finally {
    Object.entries(originalFieldMethods).forEach(([name, implementation]) => {
      fieldModel[name] = implementation;
    });
    amcModel.countActiveContracts = originalCountActiveContracts;
    siteModel.listByCompany = originalListByCompany;
  }

  assert.equal(peakInFlight, 3);
});

test('dashboard recommendation uses the linked registered device and job details', async () => {
  const originalMethods = {};
  const originalCountActiveContracts = amcModel.countActiveContracts;
  const originalListByCompany = siteModel.listByCompany;
  const originalListAttachments = attachmentModel.listByEntity;
  const recommendation = {
    id: 'recommendation-1',
    company_id: 'company-1',
    job_id: 'job-1',
    job_code: 'EC-001',
    job_title: 'VFD Fault Diagnosis',
    job_created_at: '2026-10-15T10:00:00.000Z',
    job_engineer_name: 'A. Specialist',
    job_engineer_trade: 'VFD Specialist',
    job_engineer_rating: '4.8',
    site_id: 'site-1',
    device_id: 'device-1',
    device_site_id: 'site-1',
    device_type: 'vfd',
    manufacturer: 'ABB',
    model: 'ACS550',
    serial_number: 'SN-1',
    power_rating: '15–37 kW',
    installation_location: 'Main plant',
    kind: 'recommendation',
    title: 'Component repair required',
    detail: 'Output phase fault.',
    status: 'open',
    issues_found: [{ description: 'IGBT module not working', status: 'open' }],
    scope_costs: { repair_only: '₹3,500 – ₹5,000' },
    created_at: '2026-10-15T10:05:00.000Z',
  };
  const methods = {
    listJobs: async () => [],
    countJobs: async () => ({ active: 0, sla_risk: 0 }),
    latestOpenSignals: async () => ({ recommendation }),
    listAmc: async () => [],
    listCerts: async () => [],
    listCatalog: async () => [],
  };
  Object.entries(methods).forEach(([name, implementation]) => {
    originalMethods[name] = fieldModel[name];
    fieldModel[name] = implementation;
  });

  amcModel.countActiveContracts = async () => 0;
  siteModel.listByCompany = async () => [];
  attachmentModel.listByEntity = async () => [];

  try {
    const snapshot = await fieldService.snapshot(
      { company_id: 'company-1' },
      { readMarketplace: false, createRepairs: true },
    );
    assert.deepEqual(
      {
        deviceId: snapshot.recommendation.deviceId,
        deviceSiteId: snapshot.recommendation.deviceSiteId,
        manufacturer: snapshot.recommendation.manufacturer,
        model: snapshot.recommendation.model,
        powerRating: snapshot.recommendation.powerRating,
        jobCode: snapshot.recommendation.jobCode,
        jobTitle: snapshot.recommendation.jobTitle,
        specialist: snapshot.recommendation.jobEngineerName,
      },
      {
        deviceId: 'device-1',
        deviceSiteId: 'site-1',
        manufacturer: 'ABB',
        model: 'ACS550',
        powerRating: '15–37 kW',
        jobCode: 'EC-001',
        jobTitle: 'VFD Fault Diagnosis',
        specialist: 'A. Specialist',
      },
    );
  } finally {
    Object.entries(originalMethods).forEach(([name, implementation]) => {
      fieldModel[name] = implementation;
    });
    amcModel.countActiveContracts = originalCountActiveContracts;
    siteModel.listByCompany = originalListByCompany;
    attachmentModel.listByEntity = originalListAttachments;
  }
});

test('dashboard specialist card falls back to a real on-the-way job without an open signal', async () => {
  const originalMethods = {};
  const originalCountActiveContracts = amcModel.countActiveContracts;
  const originalListByCompany = siteModel.listByCompany;
  const job = {
    id: 'job-1',
    code: 'EC-001',
    title: 'MCC panel repair',
    category: 'panel_mcc',
    priority: 'normal',
    status: 'on_the_way',
    location_label: 'Plant 1',
    engineer_name: 'A. Specialist',
    engineer_trade: 'Panel technician',
    rating: null,
    estimate_amount: null,
    sla_due_at: null,
    eta_minutes: 15,
    notes: '',
    created_at: '2026-10-15T10:00:00.000Z',
    updated_at: '2026-10-15T10:05:00.000Z',
  };
  const methods = {
    listJobs: async () => [job],
    countJobs: async () => ({ active: 1, sla_risk: 0 }),
    latestOpenSignals: async () => ({}),
    listAmc: async () => [],
    listCerts: async () => [],
    listCatalog: async () => [],
    listSpares: async () => [],
  };
  Object.entries(methods).forEach(([name, implementation]) => {
    originalMethods[name] = fieldModel[name];
    fieldModel[name] = implementation;
  });
  amcModel.countActiveContracts = async () => 0;
  siteModel.listByCompany = async () => [];

  try {
    const snapshot = await fieldService.snapshot(
      { company_id: 'company-1' },
      { readMarketplace: true, createRepairs: true },
    );
    assert.equal(snapshot.liveJob.jobId, 'job-1');
    assert.equal(snapshot.liveJob.title, 'A. Specialist is on the way');
    assert.equal(snapshot.liveJob.job.title, 'MCC panel repair');
    assert.equal(snapshot.liveJob.etaMinutes, 15);
    assert.equal(snapshot.alertCount, 1);
  } finally {
    Object.entries(originalMethods).forEach(([name, implementation]) => {
      fieldModel[name] = implementation;
    });
    amcModel.countActiveContracts = originalCountActiveContracts;
    siteModel.listByCompany = originalListByCompany;
  }
});
