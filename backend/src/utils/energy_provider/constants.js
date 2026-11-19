/**
 * Domain constants shared by the services.
 */

/** Document checklist per partner role (from the product documentation). */
const REQUIRED_DOCUMENTS = {
  service_partner: [
    { type: 'id_proof', label: 'ID Proof', required: true },
    { type: 'address_proof', label: 'Address Proof', required: true },
    { type: 'educational_certificate', label: 'Educational Certificate', required: true },
    { type: 'certification', label: 'Professional Certifications', required: false },
  ],
  repairing_partner: [
    { type: 'business_registration', label: 'Business Registration', required: true },
    { type: 'gst', label: 'GST Certificate', required: true },
    { type: 'workshop_address', label: 'Workshop Address Proof', required: true },
    { type: 'owner_id', label: "Owner's ID Proof", required: true },
    { type: 'oem_certificate', label: 'Brand / OEM Certifications', required: false },
  ],
  panel_maker: [
    { type: 'gst', label: 'GST Certificate', required: true },
    { type: 'shop_license', label: 'Shop License', required: true },
    { type: 'fabrication_unit_address', label: 'Fabrication Unit Address Proof', required: true },
    { type: 'owner_id', label: "Owner's ID Proof", required: true },
    { type: 'oem_certificate', label: 'Brand / OEM Certifications', required: false },
  ],
  supplier: [
    { type: 'gst', label: 'GST Certificate', required: true },
    { type: 'shop_license', label: 'Shop License', required: true },
    { type: 'address_proof', label: 'Business Address Proof', required: true },
    { type: 'owner_id', label: "Owner's ID Proof", required: true },
  ],
};

const VALID_ROLES = Object.keys(REQUIRED_DOCUMENTS);

const EXPERIENCE_OPTIONS = [
  'Less than 1 year',
  '1 – 3 years',
  '3 – 5 years',
  '5 – 10 years',
  '10+ years',
];

const QUALIFICATION_OPTIONS = [
  'ITI — Electrician Trade',
  'Diploma — Electrical/Electronics',
  'B.Tech / B.E. — Electrical/Electronics',
  'Other Technical Certification',
];

const ROLE_CATEGORIES = {
  service_partner: ['Electrician', 'PLC / SCADA', 'VFD / Drives', 'Panel / MCC', 'Cabling', 'Compliance & Audit'],
  repairing_partner: ['VFD', 'PLC', 'Servo Drives', 'HMI', 'Soft Starter', 'Power Supply', 'Temperature Controller'],
  panel_maker: [
    'New Starter & MCB Panel',
    'VFD Panel',
    'Control Panel',
    'Distribution Board',
    'APFC / Capacitor Bank',
    'Earthing Systems',
  ],
  supplier: [
    'Switchgear',
    'Cables & Wires',
    'VFD / Drives',
    'PLC / Automation',
    'Panel Components',
    'Tools & Safety Gear',
    'Lighting',
  ],
};

/** Partner roles that can be switched between in the demo build. */
const PARTNER_ROLES = VALID_ROLES;

/** Specialization categories shown on the specializations screen. */
const SPECIALIZATION_CATEGORIES = {
  electrician: ['General Wiring & Repair', 'HT/LT Panel Work', 'MCB / MCCB', 'Industrial Earthing'],
  plc: ['PLC Programming', 'HMI Configuration', 'PLC Fault Diagnosis'],
  vfd: ['VFD Commissioning', 'Servo Drive Repair', 'Inverter Troubleshooting'],
  panel: ['Panel Fabrication', 'Panel Repair', 'Panel Upgrade', 'MCC Maintenance'],
  cabling: ['HT Cabling', 'LT Cabling', 'Fiber Cabling', 'LAN Cabling'],
  audit: ['IS/IEC Audit', 'Compliance Documentation'],
};

/** Brands a repairing partner can be certified for. */
const OEM_BRANDS = ['ABB', 'Siemens', 'Yaskawa', 'Schneider', 'L&T', 'Delta'];

const VEHICLE_TYPES = ['bike_scooter', 'car', 'van_tempo'];

/** Equipment types that are eligible for a repair-centre recommendation. */
const REPAIR_CENTRE_EQUIPMENT = [
  'vfd',
  'plc',
  'hmi',
  'servo',
  'softstarter',
  'powersupply',
  'tempcontroller',
];

/** The five step field workflow. */
const FIELD_WORKFLOW_STEPS = [
  { stepNumber: 1, stepKey: 'checkin', label: 'Check-in at Site' },
  { stepNumber: 2, stepKey: 'diagnosis', label: 'Diagnosis' },
  { stepNumber: 3, stepKey: 'parts', label: 'Site-Replaceable Parts Used' },
  { stepNumber: 4, stepKey: 'photos', label: 'Before / After Photos' },
  { stepNumber: 5, stepKey: 'signoff', label: 'Completion & Sign-off' },
];

const ISSUE_TAGS = [
  'Output phase fault',
  'IGBT module damaged',
  'Cooling fan failure',
  'Loose terminal',
  'Parameter misconfig',
  'Overcurrent',
];

/** Parts that may be replaced on site - anything else goes to the workshop. */
const SITE_REPLACEABLE_PARTS = [
  'fuse',
  'fan',
  'cable',
  'contactor',
  'terminal block',
  'capacitor',
];

/** Parts that must go to the service centre instead of being fitted on site. */
const SERVICE_CENTRE_PARTS = ['igbt', 'pcb', 'driver', 'board', 'capacitor board'];

const PRODUCT_CATEGORIES = [
  'Switchgear',
  'Cables & Wires',
  'VFD / Drives',
  'PLC / Automation',
  'Panel Components',
  'Tools & Safety Gear',
  'Lighting',
  // Keep the original value accepted for existing catalogue records.
  'Tools & Safety',
];

const PRODUCT_STATUSES = ['active', 'out_of_stock', 'delisted'];

const TRAVEL_RADII = [0, 5, 10, 15, 25];

module.exports = {
  REQUIRED_DOCUMENTS,
  VALID_ROLES,
  EXPERIENCE_OPTIONS,
  QUALIFICATION_OPTIONS,
  ROLE_CATEGORIES,
  PARTNER_ROLES,
  SPECIALIZATION_CATEGORIES,
  OEM_BRANDS,
  VEHICLE_TYPES,
  REPAIR_CENTRE_EQUIPMENT,
  FIELD_WORKFLOW_STEPS,
  ISSUE_TAGS,
  SITE_REPLACEABLE_PARTS,
  SERVICE_CENTRE_PARTS,
  PRODUCT_CATEGORIES,
  PRODUCT_STATUSES,
  TRAVEL_RADII,
};
