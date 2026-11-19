const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

const CONTRACT_REQUESTS = new Set(['renewal', 'visit', 'coverage_change']);
const SCOPE_TYPES = new Set([
  'mcc_panel',
  'vfd_panel',
  'control_panel',
  'distribution_board',
  'apfc_capacitor_bank',
  'machine_electrical_connection',
  'plc',
  'vfd_installation',
  'servo',
  'power_cable_layout',
  'fiber_network',
  'lan_structured_cabling',
]);
const BUDGET_TYPES = new Set([
  'mcc_panel',
  'control_panel',
  'apfc_capacitor_bank',
  'complete_plant_electrical_setup',
  'plc',
  'hmi_scada',
  'plant_expansion',
  'factory_relocation_rewiring',
]);

const PROJECT_CATEGORY_PRESENTATION = {
  electrical: { title: 'Electrical Projects', detail: 'Panels • boards • earthing' },
  automation: { title: 'Automation Projects', detail: 'PLC • VFD • HMI • Servo' },
  cabling: { title: 'New Cable Installation', detail: 'Power • instrumentation • fiber • LAN' },
  plant_expansion: { title: 'Plant Expansion', detail: 'New machine • factory setup • relocation' },
};

const PROJECT_TYPE_PRESENTATION = {
  mcc_panel: {
    title: 'New MCC Panel',
    detail: 'Motor control center — design, supply & install',
    intro: 'Fill in your motor loads. Our engineer will design the panel and provide a detailed quote.',
    fields: [
      { key: 'motor_feeders', label: 'No. of Motor Feeders', placeholder: 'e.g. 12 feeders' },
      { key: 'largest_motor_kw', label: 'Largest Motor (kW)', placeholder: 'e.g. 37 kW' },
      { key: 'connected_load_kw', label: 'Total Connected Load (kW)', placeholder: 'e.g. 250 kW' },
    ],
  },
  control_panel: {
    title: 'New Control Panel',
    detail: 'PLC / relay / automation control panel',
    intro: 'Tell us what this panel needs to control. Upload schematic if available.',
    fields: [
      { key: 'panel_purpose', label: 'Panel Purpose', placeholder: 'e.g. Conveyor sequence control, packaging machine' },
      { key: 'requirements_description', label: 'Requirements Description', placeholder: 'e.g. 3 contactors, 2 timers, PLC I/O termination, HMI needed...', multiline: true },
    ],
  },
  distribution_board: {
    title: 'New Distribution Board',
    detail: 'LT DB, sub-DB, feeder pillar',
    intro: 'Mention total load, number of outgoing feeders, and area to be served.',
    fields: [
      { key: 'outgoing_ways', label: 'No. of Outgoing Ways', placeholder: 'e.g. 8, 16, 24' },
      { key: 'total_load', label: 'Total Load (kW / amps)', placeholder: 'e.g. 100A incoming, 50kW total' },
    ],
  },
  apfc_capacitor_bank: {
    title: 'New APFC / Capacitor Bank',
    detail: 'Power factor correction — new system',
    intro: 'Share your connected load and current power factor from the electricity bill.',
    fields: [
      { key: 'current_power_factor', label: 'Current Power Factor', placeholder: 'e.g. 0.72 (from electricity bill)' },
      { key: 'connected_load_kva', label: 'Connected Load (kVA)', placeholder: 'e.g. 500 kVA' },
    ],
  },
  earthing: {
    title: 'New Earthing System',
    detail: 'Earth pits, lightning protection',
    intro: 'For new plants, we recommend a complete earthing design as per IS 3043.',
    fields: [
      { key: 'plant_area', label: 'Plant Area (sq ft)', placeholder: 'e.g. 20,000 sqft' },
      { key: 'scope', label: 'Scope', placeholder: 'Describe the earthing scope', multiline: true },
    ],
  },
  vfd_panel: {
    title: 'New VFD Panel',
    detail: 'Variable frequency drive panel — new fabrication',
    intro: 'Mention the motor details, application, and preferred VFD brand.',
    fields: [
      { key: 'motor_rating_kw', label: 'Motor Rating (kW)', placeholder: 'e.g. 22 kW' },
      { key: 'application', label: 'Application', placeholder: 'e.g. Compressor, conveyor, pump' },
    ],
  },
  plc: {
    title: 'New PLC System',
    detail: 'New PLC, programming & commissioning',
    intro: 'Tell us what this PLC needs to control. If you have a process description, share it.',
    fields: [
      { key: 'application_process', label: 'Application / Process', placeholder: 'e.g. Conveyor automation, batch process, packaging machine' },
      { key: 'requirements_description', label: 'Requirements Description', placeholder: 'e.g. 3 conveyors in sequence, auto-start after sensor trigger, HMI needed...', multiline: true },
    ],
  },
  vfd_installation: {
    title: 'New VFD Installation',
    detail: 'Install & commission new VFD hardware',
    intro: 'You have the VFD hardware — our specialist will install, wire, and commission on site.',
    fields: [
      { key: 'motor_rating_kw', label: 'Motor Rating (kW)', placeholder: 'e.g. 22 kW' },
      { key: 'application', label: 'Application', placeholder: 'e.g. Pump, fan, compressor, conveyor' },
    ],
  },
  hmi_scada: {
    title: 'New HMI / SCADA',
    detail: 'Industrial monitoring and control system',
    intro: 'Tell us what you want to monitor and control.',
    fields: [
      { key: 'monitor_control', label: 'What to Monitor / Control', placeholder: 'e.g. 3 production lines, motor speeds, temperatures, alarms, production count...', multiline: true },
    ],
  },
  servo: {
    title: 'New Servo System',
    detail: 'Servo system design and installation',
    intro: 'Share the application and accuracy requirements.',
    fields: [
      { key: 'application', label: 'Application', placeholder: 'e.g. CNC machine axis, label applicator, winding machine' },
      { key: 'number_of_axes', label: 'No. of Axes', placeholder: 'e.g. 1, 3' },
    ],
  },
  power_cable_layout: {
    title: 'New Power Cable Layout',
    detail: 'Power cable route and installation',
    intro: 'Mention voltage rating, cable size, length, and route type.',
    fields: [
      { key: 'approximate_length', label: 'Approx. Length (m)', placeholder: 'e.g. 300m' },
      { key: 'load_to_be_fed', label: 'Load to be Fed (kW / amps)', placeholder: 'e.g. 150 kW, 250A' },
    ],
  },
  fiber_network: {
    title: 'New Fiber Network',
    detail: 'Fiber optic splicing and network installation',
    intro: 'Mention the locations to connect and approximate distances.',
    fields: [
      { key: 'locations_to_connect', label: 'Locations to Connect', placeholder: 'e.g. Server room to production floor switches, 3 locations, approx 200m...', multiline: true },
    ],
  },
  lan_structured_cabling: {
    title: 'New LAN / Structured Cabling',
    detail: 'Structured LAN and network cabling',
    intro: 'Mention number of data points, cable category, and whether rack is needed.',
    fields: [
      { key: 'data_points', label: 'No. of Data Points', placeholder: 'e.g. 48 points across 2 floors' },
    ],
  },
  machine_electrical_connection: {
    title: 'New Machine Connection',
    detail: 'Power, control & earthing for new machine',
    intro: 'Tell us the machine power requirements and location.',
    fields: [
      { key: 'machine_type', label: 'Machine Type', placeholder: 'e.g. CNC lathe, injection moulding machine' },
      { key: 'power_required', label: 'Power Required (kW)', placeholder: 'e.g. 22 kW' },
      { key: 'distance_from_main_panel', label: 'Distance from Main Panel', placeholder: 'e.g. 50m from main LT panel' },
    ],
  },
  complete_plant_electrical_setup: {
    title: 'Full Plant Electrical Setup',
    detail: 'New factory / shed — complete electrical',
    intro: 'For a complete new factory, we provide end-to-end electrical design, supply, and installation.',
    fields: [
      { key: 'plant_area', label: 'Plant Area (sq ft)', placeholder: 'e.g. 50,000 sqft' },
      { key: 'total_load', label: 'Total Load (kVA)', placeholder: 'e.g. 500 kVA' },
      { key: 'project_description', label: 'Project Description', placeholder: 'e.g. New textile plant, 3 production lines with MCC panels, need complete electrical...', multiline: true },
    ],
  },
  factory_relocation_rewiring: {
    title: 'Factory Relocation / Rewiring',
    detail: 'Shifting to new premises, rewire & reconnect',
    intro: 'We handle electrical disconnection at old site and complete reconnection at new site.',
    fields: [
      { key: 'project_description', label: 'Project Description', placeholder: 'e.g. Moving 15 machines and 2 MCC panels to new premises...', multiline: true },
    ],
  },
};

export const DEVICE_TYPES = [
  { value: 'vfd', label: 'VFD' },
  { value: 'plc', label: 'PLC' },
  { value: 'hmi', label: 'HMI' },
  { value: 'servo', label: 'Servo' },
  { value: 'mcc', label: 'MCC' },
  { value: 'panel', label: 'Panel' },
  { value: 'motor', label: 'Motor' },
  { value: 'drive', label: 'Drive' },
  { value: 'sensor', label: 'Sensor' },
  { value: 'other', label: 'Other' },
];

export const REPAIR_SCOPES = [
  { value: 'on_site', label: 'On site', summary: 'Repair the device at the plant.' },
  { value: 'workshop', label: 'Workshop', summary: 'Send the device to the workshop.' },
  { value: 'pickup_and_return', label: 'Pickup and return', summary: 'Collect the device and bring it back.' },
];

export const RECOMMENDED_REPAIR_SCOPES = [
  {
    id: 'repair_only',
    value: 'workshop',
    serviceType: 'component_repair',
    label: 'Repair Only',
    summary: 'You send hardware. We repair and return it.',
    glyph: 'wrench',
  },
  {
    id: 'repair_install',
    value: 'pickup_and_return',
    serviceType: 'component_repair',
    label: 'Repair + Install',
    summary: 'We repair the unit and install it back at your site.',
    glyph: 'settings',
  },
  {
    id: 'full_service',
    value: 'on_site',
    serviceType: 'component_repair',
    label: 'Full Service',
    summary: 'Gravity Hub handles the repair from removal through reinstallation.',
    glyph: 'plant',
  },
  {
    id: 'replacement',
    value: 'workshop',
    serviceType: 'replacement',
    label: 'New Replacement Unit',
    summary: 'Request a new unit instead of repairing the current device.',
    glyph: 'sync',
  },
];

export const REPAIR_SERVICE_TYPES = [
  { value: 'inspection', label: 'Inspection' },
  { value: 'component_repair', label: 'Component repair' },
  { value: 'replacement', label: 'Replacement' },
  { value: 'calibration', label: 'Calibration' },
  { value: 'overhaul', label: 'Overhaul' },
  { value: 'other', label: 'Other' },
];

export const REPAIR_PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

export const REPAIR_FAULT_FREQUENCIES = [
  { value: 'always', label: 'Always — device does not power on / run' },
  { value: 'intermittent', label: 'Intermittent — works sometimes' },
  { value: 'under_load', label: 'Occurs under load' },
  { value: 'after_time', label: 'Occurs after some time of operation' },
  { value: 'random', label: 'Random / unpredictable' },
];

export const PROJECT_FIELD_LABELS = {
  title: 'Project title',
  description: 'Description',
  requirements: 'Technical requirements',
  estimatedScope: 'Quantity / scope',
  preferredTimeline: 'Preferred timeline',
  budgetAmount: 'Budget',
};

export function projectCategoryPresentation(categoryCode) {
  return PROJECT_CATEGORY_PRESENTATION[categoryCode] || null;
}

export function projectTypePresentation(typeCode) {
  return PROJECT_TYPE_PRESENTATION[typeCode] || null;
}

export function projectTypeDetailFields(typeCode) {
  const presentation = projectTypePresentation(typeCode);
  return presentation ? presentation.fields : [];
}

export function labelStatus(status) {
  return String(status || '')
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function trimmed(value) {
  return String(value || '').trim();
}

function textOk(value, min, max) {
  const text = trimmed(value);
  return text.length >= min && text.length <= max;
}

export function todayStamp(now = new Date()) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function validDate(value, now = new Date()) {
  if (!DATE.test(value || '')) return false;
  return value >= todayStamp(now);
}

export function siteLabel(sites, siteId) {
  const site = (sites || []).find((item) => item.id === siteId);
  if (!site) return '';
  return [site.siteName, site.city].filter(Boolean).join(', ');
}

export function canReschedule(contract) {
  return Boolean(
    contract
    && contract.status === 'active'
    && contract.visitSchedule
    && contract.visitSchedule.nextVisitDate,
  );
}

export function projectType(categories, categoryCode, typeCode) {
  const category = (categories || []).find((item) => item.code === categoryCode);
  if (!category) return null;
  return (category.types || []).find((item) => item.code === typeCode) || null;
}

export function projectFields(typeCode) {
  if (projectTypePresentation(typeCode)) return ['siteId'];
  const fields = ['title', 'siteId', 'description', 'requirements', 'preferredTimeline'];
  if (!typeCode || SCOPE_TYPES.has(typeCode)) fields.push('estimatedScope');
  if (!typeCode || BUDGET_TYPES.has(typeCode)) fields.push('budgetAmount');
  return fields;
}

export function contractRequired(requestType) {
  return CONTRACT_REQUESTS.has(requestType);
}

// catalog: { offer, equipment, contractTypes, plantFields } from the amc_* catalog groups.
function fieldName(label) {
  return String(label || '').replace(/\s*\(.*\)$/, '');
}

export function amcCoverage(values, catalog) {
  if (values.complete && catalog.offer) return catalog.offer.label;
  return (catalog.equipment || [])
    .filter((item) => (values.equipment || []).includes(item.code))
    .map((item) => item.label)
    .join(', ');
}

export function amcQuoteErrors(values, catalog) {
  const errors = {};
  if (!values.complete && !(values.equipment || []).length) errors.equipment = 'Choose the equipment to cover.';
  if (!(catalog.contractTypes || []).some((item) => item.code === values.contractType)) {
    errors.contractType = 'Choose the contract type.';
  }
  (catalog.plantFields || []).forEach((field) => {
    const raw = values[field.code];
    if (field.meta && field.meta.required) {
      if (!textOk(raw, 1, 200)) errors[field.code] = `Enter ${fieldName(field.label)}.`;
    } else if (raw && !textOk(raw, 1, 2000)) {
      errors[field.code] = `Shorten ${fieldName(field.label)}.`;
    }
  });
  if (!values.siteId) errors.siteId = 'Choose a site.';
  return Object.keys(errors).length ? errors : null;
}

export function buildAmcQuote(values, catalog) {
  const contract = (catalog.contractTypes || []).find((item) => item.code === values.contractType);
  const lines = (catalog.plantFields || [])
    .filter((field) => trimmed(values[field.code]))
    .map((field) => `${fieldName(field.label)}: ${trimmed(values[field.code])}`);
  return {
    siteId: values.siteId,
    requestType: 'new_amc',
    requestedService: `${amcCoverage(values, catalog)} — ${contract ? contract.label : ''}`,
    description: lines.join('\n'),
    submit: true,
  };
}

export function buildAmcRenewal(contract) {
  return {
    siteId: contract.siteId,
    requestType: 'renewal',
    existingContractId: contract.id,
    requestedService: `Renew Contract — ${contract.title || contract.number}`,
    submit: true,
  };
}

export function validateReschedule(values, currentDate, now = new Date()) {
  const errors = {};
  if (!validDate(values.requestedNewDate, now)) errors.requestedNewDate = 'Choose a new date that is still ahead.';
  if (values.requestedNewDate && values.requestedNewDate === currentDate) {
    errors.requestedNewDate = 'Choose a different date.';
  }
  if (!textOk(values.reason, 2, 1000)) errors.reason = 'Choose a reason for the new date.';
  if (!TIME.test(values.requestedNewTime || '')) errors.requestedNewTime = 'Choose a visit time.';
  if (values.notes && !textOk(values.notes, 2, 1000)) errors.notes = 'Shorten the additional notes.';
  return Object.keys(errors).length ? errors : null;
}

export function buildReschedule(contract, values) {
  return {
    contractId: contract.id,
    oldScheduledDate: contract.visitSchedule.nextVisitDate,
    requestedNewDate: values.requestedNewDate,
    requestedNewTime: values.requestedNewTime || undefined,
    reason: trimmed(values.reason),
    notes: trimmed(values.notes) || undefined,
  };
}

export function validateDevice(values) {
  const errors = {};
  if (!values.siteId) errors.siteId = 'Choose a site.';
  if (!DEVICE_TYPES.some((item) => item.value === values.deviceType)) errors.deviceType = 'Choose the device type.';
  if (!textOk(values.manufacturer, 1, 120)) errors.manufacturer = 'Enter the manufacturer.';
  if (values.model && !textOk(values.model, 1, 120)) errors.model = 'Shorten the model number.';
  if (values.serialNumber && !textOk(values.serialNumber, 1, 120)) errors.serialNumber = 'Shorten the serial number.';
  if (!textOk(values.installationLocation, 1, 160)) errors.installationLocation = 'Enter where the device is installed.';
  return Object.keys(errors).length ? errors : null;
}

export function buildDevice(values) {
  const payload = {
    siteId: values.siteId,
    deviceType: values.deviceType,
    manufacturer: trimmed(values.manufacturer),
    installationLocation: trimmed(values.installationLocation),
  };
  if (trimmed(values.model)) payload.model = trimmed(values.model);
  if (trimmed(values.serialNumber)) payload.serialNumber = trimmed(values.serialNumber);
  if (trimmed(values.assetNumber)) payload.assetNumber = trimmed(values.assetNumber);
  if (trimmed(values.description)) payload.description = trimmed(values.description);
  return payload;
}

export function validateRepairIssue(values) {
  const errors = {};
  if (!values.deviceId) errors.deviceId = 'Select or register a device first.';
  if (!values.siteId) errors.siteId = 'Choose a site.';
  if (!REPAIR_SCOPES.some((item) => item.value === values.repairScope)) errors.repairScope = 'Select a repair scope first.';
  if (!REPAIR_SERVICE_TYPES.some((item) => item.value === values.serviceType)) errors.serviceType = 'Choose the service type.';
  if (!REPAIR_PRIORITIES.some((item) => item.value === values.priority)) errors.priority = 'Choose the priority.';
  if (!textOk(values.issueDescription, 2, 4000)) errors.issueDescription = 'Describe the issue.';
  if (!textOk(values.symptoms, 1, 2000)) errors.symptoms = 'Describe the symptoms.';
  if (!textOk(values.faultInformation, 1, 2000)) errors.faultInformation = 'Enter the fault details.';
  if (values.downtimeLoss && (!Number.isFinite(Number(values.downtimeLoss)) || Number(values.downtimeLoss) < 0)) {
    errors.downtimeLoss = 'Enter a valid non-negative hourly downtime loss.';
  }
  return Object.keys(errors).length ? errors : null;
}

export function buildRepair(values) {
  const frequency = REPAIR_FAULT_FREQUENCIES.find((item) => item.value === values.faultFrequency);
  const faultDetails = [
    trimmed(values.faultInformation || values.faultDescription),
    values.faultErrorCode ? `Fault code: ${trimmed(values.faultErrorCode)}` : '',
    values.errorCode ? `Error code: ${trimmed(values.errorCode)}` : '',
  ].filter(Boolean).join('\n');
  const additionalRequirements = [
    values.repairDeviceLabel ? `Device type: ${values.repairDeviceLabel}` : '',
    values.hmiScreenSize
      ? `HMI screen size: ${values.hmiScreenSize === 'other' ? trimmed(values.hmiScreenSizeOther) : `${values.hmiScreenSize}"`}`
      : '',
    values.warrantyStatus ? `Warranty status: ${values.warrantyStatus}` : '',
    frequency ? `Fault frequency: ${frequency.label}` : '',
    values.downtimeLoss ? `Downtime loss (INR/hr): ${trimmed(values.downtimeLoss)}` : '',
    values.repairLogisticsLabel ? `Logistics: ${values.repairLogisticsLabel}` : '',
    values.repairRecommendationScopeLabel
      ? `Recommended option: ${values.repairRecommendationScopeLabel}${values.repairRecommendationCost ? ` (${trimmed(values.repairRecommendationCost)})` : ''}`
      : '',
    values.preferredDate ? `Preferred date: ${trimmed(values.preferredDate)}` : '',
    values.preferredTime ? `Preferred time: ${trimmed(values.preferredTime)}` : '',
  ].filter(Boolean).join('\n').slice(0, 2000);
  const payload = {
    siteId: values.siteId,
    deviceId: values.deviceId,
    repairScope: values.repairScope,
    serviceType: values.serviceType,
    priority: values.priority,
    issueDescription: trimmed(values.issueDescription),
    symptoms: trimmed(values.symptoms),
    faultInformation: faultDetails.slice(0, 2000) || trimmed(values.faultInformation),
    submit: true,
  };
  if (additionalRequirements) payload.additionalRequirements = additionalRequirements;
  if (Array.isArray(values.attachmentIds) && values.attachmentIds.length) {
    payload.attachmentIds = values.attachmentIds;
  }
  return payload;
}

export function validateProjectDetails(fields, values) {
  const errors = {};
  const required = new Set(fields || []);
  if (required.has('siteId') && !values.siteId) errors.siteId = 'Choose a site.';
  if (required.has('title') && !textOk(values.title, 2, 160)) errors.title = 'Enter a project title.';
  if (required.has('description') && !textOk(values.description, 2, 4000)) errors.description = 'Describe the project.';
  if (required.has('requirements') && !textOk(values.requirements, 1, 4000)) {
    errors.requirements = 'Enter the technical requirements.';
  }
  if (required.has('estimatedScope') && !textOk(values.estimatedScope, 1, 4000)) {
    errors.estimatedScope = 'Enter the quantity or scope.';
  }
  if (required.has('preferredTimeline') && !textOk(values.preferredTimeline, 1, 160)) {
    errors.preferredTimeline = 'Enter the preferred timeline.';
  }
  if (required.has('budgetAmount')) {
    const amount = Number(values.budgetAmount);
    if (!Number.isFinite(amount) || amount < 0) errors.budgetAmount = 'Enter the budget amount.';
  }
  return Object.keys(errors).length ? errors : null;
}

export function buildProject(values) {
  const fields = new Set(values.fields || []);
  const typeFields = projectTypeDetailFields(values.projectTypeCode);
  const projectDetails = typeFields
    .map((field) => ({
      key: field.key,
      value: trimmed(values.projectDetailValues && values.projectDetailValues[field.key]),
      dataType: 'text',
    }))
    .filter((field) => field.value);
  const generatedDescription = projectDetails
    .map((field) => {
      const definition = typeFields.find((item) => item.key === field.key);
      return `${definition.label}: ${field.value}`;
    })
    .join('\n');
  const payload = {
    siteId: values.siteId,
    category: values.categoryCode,
    projectType: values.projectTypeCode,
    title: trimmed(values.title || values.projectTypeName),
    description: trimmed(
      values.description || generatedDescription || `${values.projectTypeName || 'Project'} request`,
    ),
    submit: true,
  };
  if (fields.has('requirements')) payload.requirements = trimmed(values.requirements);
  if (fields.has('estimatedScope')) payload.estimatedScope = trimmed(values.estimatedScope);
  if (fields.has('preferredTimeline')) payload.preferredTimeline = trimmed(values.preferredTimeline);
  if (fields.has('budgetAmount')) {
    payload.budgetAmount = Number(values.budgetAmount);
    payload.budgetCurrency = 'INR';
  }
  if (Array.isArray(values.attachmentIds) && values.attachmentIds.length) {
    payload.attachmentIds = values.attachmentIds;
  }
  const detailRows = [...projectDetails];
  if (values.consultationType) {
    detailRows.push({
      key: 'consultation_type',
      value: trimmed(values.consultationTypeLabel || values.consultationType),
      dataType: 'text',
    });
  }
  if (detailRows.length) payload.details = detailRows;
  if (values.preferredDate) {
    payload.details = [
      ...(payload.details || []),
      { key: 'preferred_date', value: trimmed(values.preferredDate), dataType: 'date' },
    ];
  }
  if (values.preferredTime) {
    payload.details = [
      ...(payload.details || []),
      { key: 'preferred_time', value: trimmed(values.preferredTime), dataType: 'text' },
    ];
  }
  return payload;
}

export function submittedAmc(result) {
  return Boolean(result && result.confirmation && result.confirmation.referenceId && result.confirmation.status === 'submitted');
}

export function submittedReschedule(result) {
  return Boolean(result && result.reschedule && result.reschedule.id && result.reschedule.status);
}

export function submittedTicket(result) {
  return Boolean(result && result.confirmation && result.confirmation.ticketNumber && result.confirmation.status === 'submitted');
}

export function submittedProject(result) {
  return Boolean(result && result.confirmation && result.confirmation.projectRequestId && result.confirmation.status === 'submitted');
}
