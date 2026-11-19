export const REPAIR_STEPS = [
  'Device',
  'Make',
  'Fault',
  'Details',
  'Scope',
  'Logistics',
  'Issue Details',
  'Select Site',
  'Confirm',
];

export const REPAIR_DEVICE_OPTIONS = [
  { value: 'plc', label: 'PLC / Controller', detail: 'Siemens, Allen Bradley, Mitsubishi, Delta', glyph: 'book' },
  { value: 'hmi', label: 'HMI / Touchscreen Panel', detail: 'Siemens, Weintek, Delta, Proface', glyph: 'hmi' },
  { value: 'vfd', label: 'VFD / Inverter', detail: 'ABB, Siemens, Danfoss, Schneider, Delta', glyph: 'sync' },
  { value: 'servo', label: 'Servo Drive / Amplifier', detail: 'Siemens, Yaskawa, Mitsubishi, Fanuc', glyph: 'settings' },
  { value: 'dc', apiType: 'drive', label: 'DC Drive', detail: 'ABB DCS, Eurotherm, Siemens SIMOREG', glyph: 'bolt' },
  { value: 'scada', apiType: 'other', label: 'SCADA / Industrial PC', detail: 'Industrial computer, SCADA hardware', glyph: 'scada' },
  { value: 'other', label: 'Other Electronic Device', detail: 'Control board, relay module, power supply', glyph: 'wrench' },
];

const COMMON_FAULTS = ['Burnt / fire damage', 'Intermittent fault'];

const DEVICE_FAULTS = {
  plc: ['CPU fault', 'I/O error', 'Program lost', 'Battery dead', 'Memory error', 'Communication loss', 'Watchdog fault'],
  hmi: ['Touch not responding', 'Display blank', 'Backlight off', 'Cracked screen', 'Slow response', 'USB / port damaged', 'Boot loop'],
  vfd: ['OC trip (Overcurrent)', 'OV / UV (Voltage fault)', 'Overheating', 'Burnt IGBT', 'Capacitor blown', 'Display dead', 'Output phase loss'],
  servo: ['Servo alarm', 'Encoder fault', 'Position error', 'Brake fault', 'Amplifier dead', 'Burnt board', 'Communication loss'],
  dc: ['Thyristor fault', 'Armature short', 'SCR firing fault', 'Field weakening fault', 'Burnt board', 'DC bus fault', 'Capacitor blown'],
  scada: ['Boot failure', 'HDD / SSD crash', 'OPC server crash', 'Network card fault', 'Screen freeze', 'RAM error', 'USB / port issue'],
  other: ['Dead / no power', 'Display issue', 'PCB damaged', 'Component blown', 'Error code', 'Connector damaged'],
};

const MODEL_HINTS = {
  ABB: 'e.g. ACS550, AC500, ACS880, S800',
  'Allen-Bradley (Rockwell Automation)': 'e.g. ControlLogix, PowerFlex 525, PanelView',
  Danfoss: 'e.g. VLT FC 302, VLT AQUA, FC 102',
  'Delta Electronics': 'e.g. MS300, DVP-SS2, ASD-A2, DOP-H',
  'Fuji Electric': 'e.g. FRENIC-MEGA, SPF, Monitouch',
  Innovative: 'e.g. iDrive, iPLC, iHMI series',
  'L&T (Larsen & Toubro)': 'e.g. LK series, SX2000, AURA-E',
  'Mitsubishi Electric': 'e.g. FR-A800, FX5U, MR-J4, GOT2000',
  'Rishabh Instruments': 'e.g. Rish-PLC, Conzerv HMI',
  'Schneider Electric (Modicon)': 'e.g. ATV320, M340, Quantum, Magelis',
  'Selec Controls': 'e.g. MFM, PIC, XM series',
  Siemens: 'e.g. S7-1200, SINAMICS G120, KTP HMI',
  'Other Make': 'e.g. Enter model number',
};

export function repairFaultOptions(deviceKind) {
  return [...(DEVICE_FAULTS[deviceKind] || DEVICE_FAULTS.other), ...COMMON_FAULTS];
}

export function repairModelHint(make) {
  return MODEL_HINTS[make] || 'e.g. S7-1200, ACS550';
}

export const HMI_SCREEN_SIZES = ['3.5', '4.3', '5.7', '7', '10.1', '12', '15', 'other'];

export const REPAIR_SCOPE_OPTIONS = [
  {
    id: 'repair_only',
    value: 'workshop',
    serviceType: 'component_repair',
    label: 'Repair Only',
    summary: 'Workshop repair and return. Select delivery next.',
    glyph: 'wrench',
  },
  {
    id: 'repair_install',
    value: 'pickup_and_return',
    serviceType: 'component_repair',
    label: 'Repair + Install',
    summary: 'Workshop repair and installation at your site.',
    glyph: 'settings',
  },
  {
    id: 'full_service',
    value: 'on_site',
    serviceType: 'component_repair',
    label: 'Full Service',
    summary: 'On-site removal, workshop repair and reinstallation.',
    glyph: 'plant',
  },
];

export const REPAIR_LOGISTICS_OPTIONS = [
  {
    value: 'zypli-pickdrop',
    label: 'Gravity Hub Pick & Drop',
    detail: 'Gravity Hub coordinates pickup from your site and returns the repaired device.',
    glyph: 'box',
  },
  {
    value: 'porter',
    label: 'Porter',
    detail: 'Open Porter to arrange transport to the service center.',
    glyph: 'box',
  },
  {
    value: 'olauber',
    label: 'Ola / Uber',
    detail: 'Arrange transport using your preferred ride service.',
    glyph: 'call',
  },
  {
    value: 'courier',
    label: 'Courier — Delhivery / BlueDart',
    detail: 'Send the device using your preferred courier service.',
    glyph: 'box',
  },
  {
    value: 'self',
    label: 'Drop it Myself',
    detail: 'Take the device to the service center.',
    glyph: 'pin',
  },
];

export const REPAIR_WORKSHOP_ADDRESS = 'Plot No. 42, Industrial Area Phase 2, Sitapura, Jaipur — 302022';

export function recommendedRepairScope(scopeId) {
  const options = [
    ...REPAIR_SCOPE_OPTIONS,
    {
      id: 'replacement',
      value: 'workshop',
      serviceType: 'replacement',
      label: 'New Replacement Unit',
      summary: 'Request a new unit instead of repairing this one.',
      glyph: 'sync',
    },
  ];
  return options.find((scope) => scope.id === scopeId) || null;
}
