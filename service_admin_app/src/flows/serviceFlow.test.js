import {
  activeStep,
  applyAnswer,
  buildServiceRequest,
  pathFromTrail,
  reviewRows,
  unsupportedField,
  visibleFields,
} from './serviceFlow';

describe('quick-service form configuration', () => {
  test('routes Panel / MCC branches from the currently selected panel type', () => {
    const steps = [
      { id: 'panel_type', code: 'panel_type', kind: 'choice', options: [] },
      { id: 'mcc_work', code: 'mcc_work_type', kind: 'choice', parentOptionId: 'mcc' },
      { id: 'busbar_work', code: 'busbar_work_type', kind: 'choice', parentOptionId: 'busbar' },
      { id: 'mcc_detail', code: 'mcc_details', kind: 'form', parentOptionId: 'fault' },
    ];

    const busbarPath = pathFromTrail([
      { type: 'choice', stepId: 'panel_type', optionId: 'busbar' },
    ]);
    expect(activeStep(steps, busbarPath).id).toBe('busbar_work');

    const mccPath = pathFromTrail([
      { type: 'choice', stepId: 'panel_type', optionId: 'mcc' },
    ]);
    expect(activeStep(steps, mccPath).id).toBe('mcc_work');
    expect(activeStep(steps, [...mccPath, { stepId: 'mcc_work', optionId: 'fault' }]).id)
      .toBe('mcc_detail');
  });

  test('uses the shared add-make picker and clears stale dependent answers', () => {
    const step = {
      code: 'vfd_details',
      fields: [
        { id: 'make', key: 'make', type: 'select', label: 'Make', options: [] },
        { id: 'specify', key: 'specify_make', type: 'text', label: 'Specify make' },
        { id: 'model', key: 'drive_model', type: 'text', label: 'Model' },
      ],
    };
    const otherMake = applyAnswer(step.fields, {}, 'make', 'other');
    expect(visibleFields(step, otherMake).map((field) => field.id)).toEqual(['make', 'model']);

    const knownMake = applyAnswer(step.fields, { ...otherMake, specify: 'Acme' }, 'make', 'abb');
    expect(knownMake.specify).toBeUndefined();
    expect(visibleFields(step, knownMake).map((field) => field.id)).toEqual(['make', 'model']);
  });

  test('surfaces missing fields and select options instead of rendering a blank step', () => {
    expect(unsupportedField([])).toMatchObject({ label: 'Service fields', issue: 'missing' });
    expect(unsupportedField([
      { id: 'urgency', label: 'Urgency', type: 'select', options: [] },
    ])).toMatchObject({ id: 'urgency' });
  });

  test('includes selected date and time in the review and service request payload', () => {
    const draft = {
      categoryId: 'category-1',
      siteId: 'site-1',
      preferredDate: '2026-11-15',
      preferredTime: '09:00',
      trail: [{ type: 'choice', stepId: 'service-type', optionId: 'repair', stepTitle: 'Service', optionName: 'Repair' }],
      steps: [],
    };

    expect(reviewRows(draft, { siteName: 'Plant 1' })).toEqual(expect.arrayContaining([
      { label: 'Preferred date', value: '2026-11-15' },
      { label: 'Preferred time', value: '09:00' },
    ]));
    expect(buildServiceRequest(draft)).toMatchObject({
      preferredDate: '2026-11-15',
      preferredTime: '09:00',
    });
  });
});
