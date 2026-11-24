import {
  amcCoverage,
  amcQuoteErrors,
  buildAmcQuote,
  buildProject,
  buildRepair,
  buildReschedule,
  projectFields,
  projectTypeDetailFields,
  validateReschedule,
} from './customerFlow';

describe('AMC quote flow', () => {
  const catalog = {
    offer: { label: 'Complete AMC' },
    equipment: [
      { code: 'vfd', label: 'VFD / Drives' },
      { code: 'plc', label: 'PLC / Automation' },
    ],
    contractTypes: [
      { code: 'comprehensive', label: 'Comprehensive AMC' },
    ],
    plantFields: [
      { code: 'plantArea', label: 'Plant area', meta: { required: true } },
    ],
  };

  test('requires complete equipment or explicit equipment selection', () => {
    expect(amcQuoteErrors({}, catalog)).toMatchObject({
      equipment: 'Choose the equipment to cover.',
    });
  });

  test('builds a submitted new AMC request without requiring a preferred date', () => {
    const payload = buildAmcQuote({
      complete: true,
      contractType: 'comprehensive',
      plantArea: '5000 sq ft',
      siteId: 'site-1',
    }, catalog);
    expect(payload).toEqual({
      siteId: 'site-1',
      requestType: 'new_amc',
      requestedService: 'Complete AMC — Comprehensive AMC',
      description: 'Plant area: 5000 sq ft',
      submit: true,
    });
  });

  test('covers selected equipment explicitly when complete mode is off', () => {
    expect(amcCoverage({
      complete: false,
      equipment: ['vfd', 'plc'],
    }, catalog)).toBe('VFD / Drives, PLC / Automation');
  });
});

describe('AMC reschedule flow', () => {
  const now = new Date('2026-10-11T00:00:00');
  const contract = {
    id: 'contract-1',
    visitSchedule: { nextVisitDate: '2026-10-20' },
  };

  test('requires a future date, visit time, and selected reason', () => {
    expect(validateReschedule({
      requestedNewDate: '2026-10-20',
      requestedNewTime: '',
      reason: '',
    }, contract.visitSchedule.nextVisitDate, now)).toMatchObject({
      requestedNewDate: 'Choose a different date.',
      requestedNewTime: 'Choose a visit time.',
      reason: 'Choose a reason for the new date.',
    });
  });

  test('builds a request with the chosen schedule and optional notes', () => {
    expect(buildReschedule(contract, {
      requestedNewDate: '2026-10-22',
      requestedNewTime: '14:00',
      reason: 'Production schedule conflict',
      notes: 'Shutdown begins at noon.',
    })).toEqual({
      contractId: 'contract-1',
      oldScheduledDate: '2026-10-20',
      requestedNewDate: '2026-10-22',
      requestedNewTime: '14:00',
      reason: 'Production schedule conflict',
      notes: 'Shutdown begins at noon.',
    });
  });

});

describe('project consultation selection', () => {
  test('includes the chosen consultation in supported project details', () => {
    expect(buildProject({
      fields: ['title', 'siteId', 'description'],
      categoryCode: 'panels',
      projectTypeCode: 'mcc_panel',
      title: 'New MCC panel',
      siteId: 'site-1',
      description: 'Install an MCC panel.',
      consultationType: 'site_visit',
      consultationTypeLabel: 'Site Visit & Assessment',
    })).toMatchObject({
      details: [{
        key: 'consultation_type',
        value: 'Site Visit & Assessment',
        dataType: 'text',
      }],
    });
  });

  test('uses prototype project fields and submits the entered details', () => {
    const values = {
      fields: projectFields('mcc_panel'),
      categoryCode: 'electrical',
      projectTypeCode: 'mcc_panel',
      projectTypeName: 'New MCC Panel',
      siteId: 'site-1',
      projectDetailValues: {
        motor_feeders: '12',
        largest_motor_kw: '37 kW',
      },
      consultationType: 'free_call',
      consultationTypeLabel: 'Free Call Discussion',
    };

    expect(projectTypeDetailFields('mcc_panel').map((field) => field.label)).toEqual([
      'No. of Motor Feeders',
      'Largest Motor (kW)',
      'Total Connected Load (kW)',
    ]);
    expect(buildProject(values)).toMatchObject({
      title: 'New MCC Panel',
      description: 'No. of Motor Feeders: 12\nLargest Motor (kW): 37 kW',
      details: [
        { key: 'motor_feeders', value: '12', dataType: 'text' },
        { key: 'largest_motor_kw', value: '37 kW', dataType: 'text' },
        { key: 'consultation_type', value: 'Free Call Discussion', dataType: 'text' },
      ],
    });
  });

  test('persists selected project date and time in the request details', () => {
    expect(buildProject({
      fields: ['siteId'],
      categoryCode: 'electrical',
      projectTypeCode: 'mcc_panel',
      projectTypeName: 'New MCC Panel',
      siteId: 'site-1',
      preferredDate: '2026-11-15',
      preferredTime: '09:00',
    }).details).toEqual([
      { key: 'preferred_date', value: '2026-11-15', dataType: 'date' },
      { key: 'preferred_time', value: '09:00', dataType: 'text' },
    ]);
  });

  describe('repair recommendation booking details', () => {
    test('preserves the recommended option and selected booking time in the ticket', () => {
      const ticket = buildRepair({
        siteId: 'site-1',
        deviceId: 'device-1',
        repairScope: 'workshop',
        serviceType: 'component_repair',
        priority: 'urgent',
        issueDescription: 'Drive output phase fault.',
        symptoms: 'Output phase fault',
        faultInformation: 'IGBT module damage.',
        repairDeviceLabel: 'VFD',
        repairLogisticsLabel: 'Gravity Hub Pickup & Drop',
        repairRecommendationScopeLabel: 'Repair Only',
        repairRecommendationCost: '₹3,500 – ₹5,000',
        preferredDate: '2026-10-20',
        preferredTime: 'Emergency',
      });

      expect(ticket.additionalRequirements).toContain('Recommended option: Repair Only (₹3,500 – ₹5,000)');
      expect(ticket.additionalRequirements).toContain('Preferred date: 2026-10-20');
      expect(ticket.additionalRequirements).toContain('Preferred time: Emergency');
    });
  });
});
