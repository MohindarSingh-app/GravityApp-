const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const AppError = require('../../../src/utils/energy_service/AppError');
const {
  AMC_REQUEST_STATUSES,
  AMC_REQUEST_TRANSITIONS,
  REPAIR_STATUSES,
  REPAIR_TRANSITIONS,
  PROJECT_STATUSES,
  PROJECT_TRANSITIONS,
  canTransition,
  assertStatusChange,
} = require('../../../src/domain/energy_service/customerStatus');
const schemas = require('../../../src/validators/energy_service/customer.validator');

const sql = fs.readFileSync(
  path.join(__dirname, '../../../database/energy_service/migrations/006_customer_panel.sql'),
  'utf8',
);

const PROJECT_NAMES = [
  'Electrical',
  'Automation',
  'Cabling',
  'Plant Expansion',
  'MCC Panel',
  'VFD Panel',
  'Control Panel',
  'Distribution Board',
  'APFC / Capacitor Bank',
  'Earthing',
  'PLC',
  'VFD Installation',
  'HMI / SCADA',
  'Servo',
  'Power Cable Layout',
  'Fiber Network',
  'LAN / Structured Cabling',
  'Machine Electrical Connection',
  'Complete Plant Electrical Setup',
  'Factory Relocation / Rewiring',
];

function assertChain(machine, chain) {
  for (let index = 0; index < chain.length - 1; index += 1) {
    assert.equal(canTransition(machine, chain[index], chain[index + 1]), true, `${chain[index]} -> ${chain[index + 1]}`);
  }
}

function assertClosed(machine, statuses) {
  assert.deepEqual(Object.keys(machine).sort(), [...statuses].sort());
  for (const from of statuses) {
    for (const to of statuses) {
      if (from === to) {
        assert.equal(canTransition(machine, from, to), false);
      }
    }
    assert.equal(canTransition(machine, 'completed', 'cancelled'), false);
    assert.equal(canTransition(machine, 'cancelled', from === 'cancelled' ? 'draft' : from), from === 'cancelled' ? false : canTransition(machine, 'cancelled', from));
  }
}

test('AMC requests follow the documented lifecycle and reject skips', () => {
  assertChain(AMC_REQUEST_TRANSITIONS, [
    'draft', 'submitted', 'under_review', 'scheduled', 'reschedule_requested', 'rescheduled', 'confirmed', 'completed',
  ]);
  assert.equal(canTransition(AMC_REQUEST_TRANSITIONS, 'draft', 'scheduled'), false);
  assert.equal(canTransition(AMC_REQUEST_TRANSITIONS, 'submitted', 'confirmed'), false);
  assert.equal(canTransition(AMC_REQUEST_TRANSITIONS, 'completed', 'cancelled'), false);
  assertClosed(AMC_REQUEST_TRANSITIONS, AMC_REQUEST_STATUSES);
});

test('repair tickets follow the documented lifecycle and reject skips', () => {
  assertChain(REPAIR_TRANSITIONS, [
    'draft', 'submitted', 'received', 'diagnosis', 'estimate_required', 'approved',
    'repair_in_progress', 'ready', 'returned', 'completed',
  ]);
  assert.equal(canTransition(REPAIR_TRANSITIONS, 'diagnosis', 'approved'), false);
  assert.equal(canTransition(REPAIR_TRANSITIONS, 'submitted', 'repair_in_progress'), false);
  assertClosed(REPAIR_TRANSITIONS, REPAIR_STATUSES);
});

test('project requests follow the documented lifecycle and reject skips', () => {
  assertChain(PROJECT_TRANSITIONS, [
    'draft', 'submitted', 'under_review', 'approved', 'in_progress', 'completed',
  ]);
  assert.equal(canTransition(PROJECT_TRANSITIONS, 'under_review', 'clarification_required'), true);
  assert.equal(canTransition(PROJECT_TRANSITIONS, 'clarification_required', 'under_review'), true);
  assert.equal(canTransition(PROJECT_TRANSITIONS, 'draft', 'approved'), false);
  assert.equal(canTransition(PROJECT_TRANSITIONS, 'submitted', 'approved'), false);
  assertClosed(PROJECT_TRANSITIONS, PROJECT_STATUSES);
});

test('customers can submit and reschedule, and cannot review AMC requests', () => {
  assert.doesNotThrow(() => assertStatusChange('amc_request', 'draft', 'submitted', 'customer'));
  assert.doesNotThrow(() => assertStatusChange('amc_request', 'scheduled', 'reschedule_requested', 'customer'));
  assert.throws(
    () => assertStatusChange('amc_request', 'submitted', 'under_review', 'customer'),
    (err) => err instanceof AppError && err.statusCode === 403,
  );
  assert.throws(
    () => assertStatusChange('amc_request', 'draft', 'confirmed', 'manage'),
    (err) => err instanceof AppError && err.code === 'INVALID_STATUS_TRANSITION',
  );
  assert.doesNotThrow(() => assertStatusChange('amc_request', 'submitted', 'under_review', 'manage'));
});

test('customers can approve a repair estimate and cannot start the repair', () => {
  assert.doesNotThrow(() => assertStatusChange('repair_ticket', 'estimate_required', 'approved', 'customer'));
  assert.throws(
    () => assertStatusChange('repair_ticket', 'approved', 'repair_in_progress', 'customer'),
    (err) => err instanceof AppError && err.statusCode === 403,
  );
});

test('customers can answer a project clarification and cannot approve it', () => {
  assert.doesNotThrow(() => assertStatusChange('project_request', 'clarification_required', 'under_review', 'customer'));
  assert.throws(
    () => assertStatusChange('project_request', 'under_review', 'approved', 'customer'),
    (err) => err instanceof AppError && err.statusCode === 403,
  );
});

test('migration stores the lifecycle vocabulary and project catalogue', () => {
  for (const value of [...AMC_REQUEST_STATUSES, ...REPAIR_STATUSES, ...PROJECT_STATUSES, ...PROJECT_NAMES]) {
    assert.equal(sql.includes(`'${value}'`), true, value);
  }
});

test('production schema names the same AMC, repair, and project objects', () => {
  const production = fs.readFileSync(
    path.join(__dirname, '../../../database/energy_service/migrations/007_customer_panel_schema.sql'),
    'utf8',
  );
  for (const name of [
    'CREATE TABLE IF NOT EXISTS customers',
    'CREATE TABLE IF NOT EXISTS amc_status_history',
    'CREATE TABLE IF NOT EXISTS repair_status_history',
    'CREATE TABLE IF NOT EXISTS project_status_history',
    'CREATE TABLE IF NOT EXISTS project_request_details',
    'RENAME TO attachments',
    'contract_type',
    'request_number',
    'service_requirement',
    'previous_schedule',
    'requested_schedule',
    'error_details',
    'file_reference',
    'mime_type',
    'uploaded_by',
    'repair_attachments',
    'project_attachments',
    'amc_attachments',
  ]) {
    assert.equal(production.includes(name), true, name);
  }
  for (const label of [
    'Plant',
    'Panels',
    'Earthing',
    'Controls/PLC',
    'VFD',
    'HMI/SCADA',
    'Servo',
    'Networking',
    'Machine Electrical',
    'Plant Setup',
    'Relocation',
    'Electrical Project',
    'Automation Project',
    'Cable Installation',
    'Earthing System',
    'PLC System',
    'Servo System',
  ]) {
    assert.equal(production.includes(`'${label}'`), true, label);
  }
});

test('create bodies accept the production field names', () => {
  const siteId = '4f4b4d4e-6c3a-4f1e-9c2b-1a2b3c4d5e6f';
  const request = schemas.createAmcRequestSchema.safeParse({
    body: {
      siteId,
      requestType: 'new_amc',
      serviceRequirement: 'Quarterly panel inspection',
    },
    query: {},
    params: {},
  });
  assert.equal(request.success, true);

  const device = schemas.createDeviceSchema.safeParse({
    body: {
      siteId,
      deviceType: 'panel',
      manufacturer: 'Zypli',
      model: 'MCC-1',
      serialNumber: 'SN-1',
      location: 'Plant room',
    },
    query: {},
    params: {},
  });
  assert.equal(device.success, true);
});

test('AMC quote submits without a preferred date', () => {
  const submitted = schemas.createAmcRequestSchema.safeParse({
    body: {
      siteId: '4f4b4d4e-6c3a-4f1e-9c2b-1a2b3c4d5e6f',
      requestType: 'new_amc',
      requestedService: 'Quarterly panel inspection',
      submit: true,
    },
    query: {},
    params: {},
  });
  assert.equal(submitted.success, true);

  const saved = schemas.createAmcRequestSchema.safeParse({
    body: {
      siteId: '4f4b4d4e-6c3a-4f1e-9c2b-1a2b3c4d5e6f',
      requestType: 'new_amc',
      requestedService: 'Quarterly panel inspection',
    },
    query: {},
    params: {},
  });
  assert.equal(saved.success, true);
  assert.equal(saved.data.body.submit, undefined);
});

test('repair scope selection is not enough to submit a ticket', () => {
  const rejected = schemas.createTicketSchema.safeParse({
    body: {
      siteId: '4f4b4d4e-6c3a-4f1e-9c2b-1a2b3c4d5e6f',
      repairScope: 'workshop',
      submit: true,
    },
    query: {},
    params: {},
  });
  assert.equal(rejected.success, false);

  const draft = schemas.createTicketSchema.safeParse({
    body: {
      siteId: '4f4b4d4e-6c3a-4f1e-9c2b-1a2b3c4d5e6f',
      repairScope: 'workshop',
    },
    query: {},
    params: {},
  });
  assert.equal(draft.success, true);
});

test('project category alone is not a project request', () => {
  const rejected = schemas.createProjectSchema.safeParse({
    body: { category: 'electrical' },
    query: {},
    params: {},
  });
  assert.equal(rejected.success, false);
});
