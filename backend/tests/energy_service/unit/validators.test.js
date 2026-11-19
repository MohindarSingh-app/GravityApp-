const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createCompanySchema } = require('../../../src/validators/energy_service/company.validator');
const { createSiteSchema } = require('../../../src/validators/energy_service/site.validator');
const { createSignalSchema } = require('../../../src/validators/energy_service/field.validator');
const { contractListQuery, createRescheduleSchema } = require('../../../src/validators/energy_service/customer.validator');
const { validate } = require('../../../src/middleware/energy_service/validate.middleware');

test('applies pagination defaults to customer list query params and rejects invalid values', () => {
  const empty = contractListQuery.safeParse({
    body: {},
    query: {},
    params: {},
  });
  assert.equal(empty.success, true);
  assert.equal(empty.data.query.page, 1);
  assert.equal(empty.data.query.limit, 20);

  const invalid = contractListQuery.safeParse({
    body: {},
    query: { page: 'NaN' },
    params: {},
  });
  assert.equal(invalid.success, false);
});

test('replaces Express-style read-only query getter with validated query params', () => {
  const req = Object.create({
    get query() {
      return {};
    },
  });
  req.body = {};
  req.params = {};
  let middlewareError;

  validate(contractListQuery)(req, {}, (error) => {
    middlewareError = error;
  });

  assert.equal(middlewareError, undefined);
  assert.equal(req.query.page, 1);
  assert.equal(req.query.limit, 20);
});

test('accepts an AMC reschedule with a selected visit time and optional notes', () => {
  const parsed = createRescheduleSchema.safeParse({
    body: {
      contractId: '11111111-1111-1111-1111-111111111111',
      oldScheduledDate: '2026-11-10',
      requestedNewDate: '2026-11-12',
      requestedNewTime: '14:00',
      reason: 'Production schedule conflict',
      notes: 'Shutdown begins at noon.',
    },
    query: {},
    params: {},
  });
  assert.equal(parsed.success, true);
  assert.equal(parsed.data.body.requestedNewTime, '14:00');

  const invalidTime = createRescheduleSchema.safeParse({
    body: {
      contractId: '11111111-1111-1111-1111-111111111111',
      oldScheduledDate: '2026-11-10',
      requestedNewDate: '2026-11-12',
      requestedNewTime: '25:61',
      reason: 'Production schedule conflict',
    },
    query: {},
    params: {},
  });
  assert.equal(invalidTime.success, false);
});

test('rejects an invalid GSTIN on company create', () => {
  const parsed = createCompanySchema.safeParse({
    body: {
      companyName: 'Acme Steel',
      gst: 'INVALIDGSTIN123',
      industry: 'Manufacturing',
      city: 'Pune',
    },
    query: {},
    params: {},
  });
  assert.equal(parsed.success, false);
});

test('accepts a format-correct test GSTIN even when its checksum is arbitrary', () => {
  const parsed = createCompanySchema.safeParse({
    body: {
      companyName: 'Acme Steel',
      gst: '27AAPFU0939F1Z0',
      industry: 'Manufacturing',
      city: 'Pune',
    },
    query: {},
    params: {},
  });
  assert.equal(parsed.success, true);
  assert.equal(parsed.data.body.gst, '27AAPFU0939F1Z0');
});

test('rejects an invalid city', () => {
  const parsed = createCompanySchema.safeParse({
    body: {
      companyName: 'Acme Steel',
      gst: '27AAPFU0939F1ZV',
      industry: 'Manufacturing',
      city: 'Pune123',
    },
    query: {},
    params: {},
  });
  assert.equal(parsed.success, false);
});

test('rejects out-of-range GPS coordinates and unknown site types', () => {
  const gps = createSiteSchema.safeParse({
    body: {
      siteName: 'Plant 1',
      fullAddress: 'Plot 12, MIDC',
      city: 'Pune',
      latitude: 91,
      longitude: 73.8,
      siteType: 'Factory',
    },
    query: {},
    params: { companyId: '11111111-1111-1111-1111-111111111111' },
  });
  assert.equal(gps.success, false);

  const type = createSiteSchema.safeParse({
    body: {
      siteName: 'Plant 1',
      fullAddress: 'Plot 12, MIDC',
      city: 'Pune',
      latitude: 18.52,
      longitude: 73.85,
      siteType: 'Shop',
    },
    query: {},
    params: { companyId: '11111111-1111-1111-1111-111111111111' },
  });
  assert.equal(type.success, false);
});

test('accepts factory, plant, warehouse, office, and other site types', () => {
  for (const siteType of ['Factory', 'plant', 'WAREHOUSE', 'office', 'Other']) {
    const parsed = createSiteSchema.safeParse({
      body: {
        siteName: 'Site A',
        fullAddress: 'Plot 12, MIDC Road',
        city: 'Pune',
        latitude: 18.5204,
        longitude: 73.8567,
        siteType,
      },
      query: {},
      params: { companyId: '11111111-1111-1111-1111-111111111111' },
    });
    assert.equal(parsed.success, true, siteType);
  }
});

test('accepts up to five photo attachments on an emergency signal', () => {
  const attachmentIds = [
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
    '33333333-3333-3333-3333-333333333333',
    '44444444-4444-4444-4444-444444444444',
    '55555555-5555-5555-5555-555555555555',
  ];
  const request = (kind, ids) => ({
    body: { kind, title: 'Power failure', detail: 'Production line stopped', attachmentIds: ids },
    query: {},
    params: {},
  });

  assert.equal(createSignalSchema.safeParse(request('emergency', attachmentIds)).success, true);
  assert.equal(createSignalSchema.safeParse(request('emergency', [...attachmentIds, '66666666-6666-6666-6666-666666666666'])).success, false);
  assert.equal(createSignalSchema.safeParse(request('expert', attachmentIds)).success, false);

  const legacyPayload = createSignalSchema.safeParse({
    body: {
      kind: 'emergency',
      title: 'Power failure',
      detail: 'Production line stopped',
      attachments: attachmentIds,
    },
    query: {},
    params: {},
  });
  assert.equal(legacyPayload.success, true);
  assert.deepEqual(legacyPayload.data.body.attachmentIds, attachmentIds);
  assert.equal('attachments' in legacyPayload.data.body, false);

  assert.equal(createSignalSchema.safeParse({
    body: {
      kind: 'emergency',
      title: 'Power failure',
      detail: 'Production line stopped',
      attachments: [...attachmentIds, '44444444-4444-4444-4444-444444444444'],
    },
    query: {},
    params: {},
  }).success, false);
  assert.equal(createSignalSchema.safeParse({
    body: {
      kind: 'emergency',
      title: 'Power failure',
      detail: 'Production line stopped',
      attachmentIds,
      attachments: attachmentIds,
    },
    query: {},
    params: {},
  }).success, false);
});

test('requires recommendations to reference one registered device and recent job', () => {
  const recommendation = {
    kind: 'recommendation',
    title: 'Component-level repair required',
    detail: 'Output phase fault confirmed.',
    siteId: '11111111-1111-1111-1111-111111111111',
    jobId: '22222222-2222-2222-2222-222222222222',
    deviceId: '33333333-3333-3333-3333-333333333333',
    attachmentIds: ['44444444-4444-4444-4444-444444444444'],
    issuesFound: [
      { description: 'IGBT module not working' },
      { description: 'Display not powering on', status: 'resolved' },
    ],
    errorCode: 'F0021',
    riskNote: 'Could fail anytime.',
    scopeCosts: { repair_only: '₹3,500 – ₹5,000' },
  };
  const request = (body) => ({ body, query: {}, params: {} });

  const parsed = createSignalSchema.safeParse(request(recommendation));
  assert.equal(parsed.success, true);
  assert.deepEqual(parsed.data.body.issuesFound[0], {
    description: 'IGBT module not working',
    status: 'open',
  });

  const unlinked = createSignalSchema.safeParse(request({
    ...recommendation,
    deviceId: undefined,
  }));
  assert.equal(unlinked.success, false);

  const wrongKind = createSignalSchema.safeParse(request({
    kind: 'expert',
    title: 'Expert call',
    detail: 'Need advice.',
    deviceId: recommendation.deviceId,
  }));
  assert.equal(wrongKind.success, false);
});
