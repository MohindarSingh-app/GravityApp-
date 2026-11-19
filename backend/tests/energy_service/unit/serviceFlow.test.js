const { test } = require('node:test');
const assert = require('node:assert/strict');
const AppError = require('../../../src/utils/energy_service/AppError');
const { activeStep, resolveSubmission, validateAnswers } = require('../../../src/domain/energy_service/serviceFlow');
const { assertStatusChange } = require('../../../src/domain/energy_service/customerStatus');

function step(partial) {
  return {
    status: 'active',
    sortOrder: partial.sortOrder || 1,
    options: [],
    fields: [],
    parentOptionId: null,
    followsStepId: null,
    ...partial,
  };
}

function option(id, code) {
  return { id, code, name: code, status: 'active' };
}

function field(partial) {
  return { status: 'active', required: false, options: [], ...partial };
}

function plcSteps() {
  return [
    step({
      id: 'make',
      code: 'plc_make',
      title: 'PLC make',
      kind: 'choice',
      sortOrder: 1,
      options: [option('siemens', 'siemens'), option('other', 'other')],
    }),
    step({
      id: 'specify',
      code: 'plc_other_make',
      title: 'Specify PLC make',
      kind: 'form',
      sortOrder: 2,
      parentOptionId: 'other',
      fields: [field({ id: 'specify-field', key: 'specify_make', label: 'Specify make', type: 'text', required: true })],
    }),
    step({
      id: 'work',
      code: 'plc_work',
      title: 'Work type',
      kind: 'choice',
      sortOrder: 3,
      followsStepId: 'make',
      options: [option('fault', 'fault'), option('programming', 'programming'), option('repair', 'repair')],
    }),
    step({
      id: 'fault-form',
      code: 'plc_fault',
      title: 'Fault details',
      kind: 'form',
      sortOrder: 4,
      parentOptionId: 'fault',
      fields: [field({
        id: 'power',
        key: 'power_status',
        label: 'Power status',
        type: 'select',
        required: true,
        options: [{ value: 'stopped', label: 'Stopped', status: 'active' }],
      })],
    }),
    step({
      id: 'program-form',
      code: 'plc_programming',
      title: 'Programming details',
      kind: 'form',
      sortOrder: 5,
      parentOptionId: 'programming',
      fields: [field({ id: 'program-notes', key: 'description', label: 'Description', type: 'textarea', required: true })],
    }),
  ];
}

test('a known PLC make goes to work type, then only the selected branch', () => {
  const steps = plcSteps();
  assert.equal(activeStep(steps, []).id, 'make');
  const afterMake = [{ stepId: 'make', optionId: 'siemens' }];
  assert.equal(activeStep(steps, afterMake).id, 'work');
  const resolved = resolveSubmission(steps, [
    { stepId: 'make', optionId: 'siemens' },
    { stepId: 'work', optionId: 'fault' },
  ]);
  assert.deepEqual(resolved.forms.map((item) => item.id), ['fault-form']);
  const details = validateAnswers(resolved.forms, [{ fieldId: 'power', value: 'stopped' }]);
  assert.equal(details.priority, null);
  assert.equal(details.answers[0].valueText, 'stopped');
});

test('other PLC make asks for the manufacturer before the work type', () => {
  const steps = plcSteps();
  const afterOther = [{ stepId: 'make', optionId: 'other' }];
  assert.equal(activeStep(steps, afterOther).id, 'specify');
  const afterSpecify = [...afterOther, { stepId: 'specify' }];
  assert.equal(activeStep(steps, afterSpecify).id, 'work');
  const resolved = resolveSubmission(steps, [
    { stepId: 'make', optionId: 'other' },
    { stepId: 'work', optionId: 'programming' },
  ]);
  assert.deepEqual(resolved.forms.map((item) => item.id), ['specify', 'program-form']);
});

test('make dropdown cannot submit the Other option without adding the actual manufacturer', () => {
  const make = field({
    id: 'make-field',
    key: 'make',
    label: 'Make',
    type: 'select',
    options: [{ value: 'other', label: 'Other Make' }],
  });
  assert.throws(
    () => validateAnswers([step({ id: 'make-step', fields: [make] })], [
      { fieldId: 'make-field', value: 'other' },
    ]),
    { code: 'VALIDATION_ERROR' },
  );
});

test('skipping a required branch is rejected', () => {
  const steps = plcSteps();
  assert.throws(
    () => resolveSubmission(steps, [{ stepId: 'make', optionId: 'siemens' }]),
    (err) => err instanceof AppError && err.code === 'INCOMPLETE_SERVICE_PATH',
  );
  assert.throws(
    () => resolveSubmission(steps, [
      { stepId: 'work', optionId: 'fault' },
    ]),
    (err) => err instanceof AppError && err.code === 'INCOMPLETE_SERVICE_PATH',
  );
});

test('answers outside the selected branch are rejected', () => {
  const steps = plcSteps();
  const resolved = resolveSubmission(steps, [
    { stepId: 'make', optionId: 'siemens' },
    { stepId: 'work', optionId: 'fault' },
  ]);
  assert.throws(
    () => validateAnswers(resolved.forms, [
      { fieldId: 'power', value: 'stopped' },
      { fieldId: 'program-notes', value: 'Change the sequence' },
    ]),
    (err) => err instanceof AppError && err.code === 'INVALID_SERVICE_FIELD',
  );
});

test('service request assignment stays with the maintenance role', () => {
  assert.throws(
    () => assertStatusChange('service_request', 'searching', 'assigned', 'customer'),
    (err) => err instanceof AppError && err.code === 'FORBIDDEN',
  );
  assert.doesNotThrow(() => assertStatusChange('service_request', 'searching', 'cancelled', 'customer'));
  assert.doesNotThrow(() => assertStatusChange('service_request', 'searching', 'assigned', 'manage'));
  assert.doesNotThrow(() => assertStatusChange('service_request', 'submitted', 'searching', 'customer'));
});
