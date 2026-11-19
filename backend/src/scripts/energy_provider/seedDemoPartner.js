const config = require('../../config/energy_provider/env');
const { db } = require('../../db/energy_provider/index');
const UserModel = require('../../models/energy_provider/UserModel');
const JobModel = require('../../models/energy_provider/JobModel');
const JobService = require('../../services/energy_provider/jobService');
const WorkflowService = require('../../services/energy_provider/workflowService');
const ProductModel = require('../../models/energy_provider/ProductModel');
const SupplierService = require('../../services/energy_provider/supplierService');
const DocumentModel = require('../../models/energy_provider/DocumentModel');
const RegistrationModel = require('../../models/energy_provider/RegistrationModel');
const {
  EarningsModel,
  InventoryModel,
  DeliveryVerificationModel,
  NotificationModel,
} = require('../../models/energy_provider/MarketplaceModels');

const DEMO_MOBILE = '9000000099';
const DEMO_EMAIL = 'demo-partner@energyhub.local';
const ROLE_DEMOS = [
  { mobile: '9000000098', email: 'demo-repair@energyhub.local', role: 'repairing_partner', name: 'Demo Repair Workshop' },
  { mobile: '9000000097', email: 'demo-panels@energyhub.local', role: 'panel_maker', name: 'Demo Panel Works' },
  { mobile: '9000000096', email: 'demo-supplier@energyhub.local', role: 'supplier', name: 'Demo Electrical Supply' },
];

const assertLocalDevelopmentDatabase = () => {
  if (config.NODE_ENV === 'production') {
    throw new Error('Demo data can only be seeded outside production.');
  }
  if (db.driver !== 'sqlite' && !['localhost', '127.0.0.1', '::1'].includes(db.settings.host)) {
    throw new Error('Demo data seeding is restricted to a local database.');
  }
};

const dayAtNoon = (daysAgo) => {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(12, 0, 0, 0);
  return date.toISOString();
};

const createCompletedDemoJob = async (partner, {
  referenceId,
  title,
  completedDaysAgo,
  grossAmount,
  netAmount,
}) => {
  let job = await JobModel.findByReference(referenceId);
  if (job) {
    if (String(job.assigned_partner_id) !== String(partner.id)) {
      throw new Error(`Demo reference ${referenceId} already belongs to another partner.`);
    }
    return;
  }

  job = await JobModel.create({
    referenceId,
    jobType: 'service',
    targetRole: 'service_partner',
    title,
    description: 'Demonstration work item. This record is sample data.',
    category: 'Electrical',
    equipment: 'VFD Drive',
    equipmentModel: 'ACS580',
    brand: 'ABB',
    issueTags: ['Overcurrent'],
    urgency: 'medium',
    customerName: 'Demo Customer',
    customerCompany: 'Demo Industrial Works',
    customerPhone: '9000000001',
    siteAddress: 'Demo industrial site, Jaipur',
    siteArea: 'Sitapura Industrial Area',
    basePay: grossAmount,
    serviceCharge: grossAmount,
    status: 'completed',
    stage: 'completed',
  });

  const completedAt = dayAtNoon(completedDaysAgo);
  const commission = Math.round((grossAmount - netAmount) * 100) / 100;
  await db.run(
    `UPDATE \`jobs\`
        SET \`assigned_partner_id\` = ?, \`total_bill\` = ?, \`payout_amount\` = ?,
            \`completed_at\` = ?, \`created_at\` = ?, \`updated_at\` = ?
      WHERE \`id\` = ?`,
    [partner.id, grossAmount, netAmount, completedAt, completedAt, completedAt, job.id]
  );

  const earning = await EarningsModel.create({
    partnerId: partner.id,
    jobId: job.id,
    source: 'service',
    grossAmount,
    commission,
    deductions: 0,
    netAmount,
    status: 'paid',
    bankReference: `DEMO-${referenceId}`,
  });
  await db.run('UPDATE `earnings` SET `created_at` = ? WHERE `id` = ?', [completedAt, earning.id]);
};

const ensureDemoPartner = async ({ mobile, email, role, name }) => {
  const found = await UserModel.findByMobile(mobile);
  if (found && (found.role !== role || found.status !== 'approved' || found.email !== email)) {
    throw new Error(`The demo mobile ${mobile} is already used by a non-demo account.`);
  }
  return found || UserModel.create({
    mobile,
    email,
    role,
    status: 'approved',
    fullName: name,
    businessName: name,
  });
};

const hoursFromNow = (hours) => new Date(Date.now() + hours * 3600 * 1000).toISOString();

const ensureOpenJob = async (job) => {
  const payload = { ...job };
  if (!payload.slaDueAt) payload.slaDueAt = hoursFromNow(12);
  const existing = await JobModel.findByReference(job.referenceId);
  if (existing) {
    if (existing.target_role !== job.targetRole) {
      throw new Error(`Demo reference ${job.referenceId} already belongs to another role.`);
    }
    if (
      job.referenceId.startsWith('DEMO-')
      && existing.status === 'open'
      && Number.isFinite(job.distanceKm)
      && Number.isFinite(job.estimatedDriveMinutes)
    ) {
      await db.run(
        'UPDATE `jobs` SET `distance_km` = ?, `estimated_drive_minutes` = ? WHERE `id` = ?',
        [job.distanceKm, job.estimatedDriveMinutes, existing.id]
      );
    }
    return existing;
  }
  return JobModel.create({
    ...job,
    description: `Demonstration request. Sample data for previewing the Energy Hub app.`,
    customerName: 'Demo Customer',
    customerCompany: 'Energy Hub Demo Industries',
    customerPhone: '9000000001',
  });
};

const ensureDemoProfile = async (partner, { role, name, experience, qualification, categories, specializations }) => {
  let application = await RegistrationModel.findLatestByUser(partner.id);
  if (application && application.status !== 'approved') {
    throw new Error(`Demo mobile ${partner.mobile} has a non-approved registration; refusing to overwrite it.`);
  }

  await UserModel.updateById(partner.id, {
    full_name: name,
    business_name: name,
    specializationStatus: 'approved',
    years_experience: experience,
    qualification,
    service_areas: 'Sitapura Industrial Area, Vishwakarma Industrial Area, Jaipur',
    travel_radius_km: 15,
    bank_account_holder: name,
    bank_account_number: 'DEMO-ACCOUNT-1234',
    bank_ifsc: 'HDFC0001234',
    bank_name: 'Demo Bank',
    partner_since: partner.partner_since || new Date().toISOString(),
    is_online: 1,
  });

  if (!application) {
    application = await RegistrationModel.create({
      userId: partner.id,
      mobile: partner.mobile,
      email: partner.email,
      role,
      status: 'approved',
      currentStep: 5,
    });
  }
  await RegistrationModel.updateById(application.id, {
    role,
    status: 'approved',
    current_step: 5,
    personal_details: {
      fullName: name,
      dateOfBirth: '1990-06-15',
      address: 'Jaipur, Rajasthan',
      emergencyContact: '9000000001',
    },
    professional_details: {
      partnerType: role,
      experience,
      qualification,
      categories,
    },
    bank_details: {
      accountHolderName: name,
      accountNumber: 'DEMO-ACCOUNT-1234',
      ifscCode: 'HDFC0001234',
      bankName: 'Demo Bank',
    },
    service_areas: 'Sitapura Industrial Area, Vishwakarma Industrial Area, Jaipur',
    travel_radius_km: 15,
    categories,
    specializations,
    specialization_status: 'approved',
    consent: true,
  });

  const notes = await NotificationModel.findByPartner(partner.id);
  if (!notes.some((note) => note.title === 'Welcome to Energy Hub Demo')) {
    await NotificationModel.create({
      partnerId: partner.id,
      type: 'application_update',
      title: 'Welcome to Energy Hub Demo',
      body: 'This is sample notification data. Explore your dashboard and available marketplace work.',
    });
  }
};

const seedDemoMarketplace = async (servicePartner, rolePartners) => {
  const urgencyCycle = ['high', 'medium', 'low'];
  const areas = [
    ['Sitapura Industrial Area', 'Sitapura Industrial Area, Jaipur', 4.2, 18],
    ['Vishwakarma Industrial Area', 'Vishwakarma Industrial Area, Jaipur', 7.5, 24],
    ['Mansarovar Industrial Area', 'Factory Road, Mansarovar Industrial Area, Jaipur', 5.1, 20],
    ['Malviya Nagar', 'Energy Hub Collection Desk, Malviya Nagar, Jaipur', 3.8, 15],
    ['C-Scheme', 'Warehouse 4, C-Scheme, Jaipur', 2.6, 11],
    ['Vaishali Nagar', 'Industrial Shed 7, Vaishali Nagar, Jaipur', 9.4, 31],
    ['Bais Godam', 'Godown Complex, Bais Godam, Jaipur', 6.0, 26],
  ];
  const svcSamples = [
    ['PLC / SCADA', 'PLC System', 'S7-1200', 'Siemens', ['Communication fault', 'Plant downtime'], 3200],
    ['VFD / Drives', 'VFD Drive', 'ACS580', 'ABB', ['Overheating', 'Cooling fan'], 4500],
    ['Electrical', 'Motor Starter', 'DOL Starter 15 HP', 'L&T', ['Repeated tripping', 'Motor inspection'], 2800],
    ['Control Panels', 'Control Panel', 'MCC Panel', 'Siemens', ['Preventive maintenance', 'Loose terminals'], 3600],
    ['VFD / Drives', 'Soft Starter', 'PSR25', 'Schneider', ['Display fault', 'Parameter loss'], 3100],
    ['PLC / SCADA', 'HMI Panel', 'Kinco 10 inch', 'Delta', ['Touch not responding', 'Boot loop'], 2400],
    ['Electrical', 'HT Breaker', 'VCB 11kV', 'Siemens', ['Spring charge failure', 'Tripping delay'], 5600],
    ['Motors', 'Induction Motor', '30 kW 4-pole', 'ABB', ['Bearing noise', 'Vibration'], 3900],
    ['Electrical', 'Power Factor Panel', 'APFC 100 kVAR', 'L&T', ['Capacitor failure', 'Low PF penalty'], 3400],
    ['PLC / SCADA', 'Remote IO Station', 'ET200SP', 'Siemens', ['Bus fault', 'Profinet drop'], 4100],
    ['VFD / Drives', 'DC Drive', 'DCS550', 'ABB', ['Armature fault', 'Fuse blown'], 4800],
    ['Control Panels', 'Distribution Board', 'TPN 8-way', 'Havells', ['Busbar heating', 'Tightening'], 2200],
    ['Motors', 'Cooling Tower Fan', '15 kW', 'Kirloskar', ['Blade imbalance', 'Gear oil leak'], 2900],
    ['Electrical', 'Servo Motor', 'Sigma-7 750W', 'Yaskawa', ['Encoder error', 'Jog fault'], 4200],
    ['Generators', 'Diesel Genset', 'C90 D5', 'Cummins', ['Start failure', 'Battery low'], 5100],
  ];
  const repSamples = [
    ['Servo Drives', 'Servo Drive', 'Sigma-7', 'Yaskawa', ['Power fault', 'Axis alarm'], 6800],
    ['PLC', 'PLC Module', 'S7-1200', 'Siemens', ['Module fault', 'Input signal issue'], 5200],
    ['VFD', 'VFD Drive', 'PowerFlex 525', 'Rockwell', ['IGBT short', 'DC bus fault'], 7400],
    ['HMI', 'HMI Terminal', 'MT8071iP', 'Weintek', ['Backlight dead', 'Touch drift'], 3800],
    ['Soft Starter', 'Soft Starter', '3RW44', 'Siemens', ['Thyristor fault', 'Fan noise'], 5600],
    ['Servo Drives', 'Servo Amplifier', 'MR-J4', 'Mitsubishi', ['Overcurrent', 'Regen fault'], 6200],
    ['PLC', 'Safety Relay', 'Guardmaster', 'Rockwell', ['Coil burnt', 'Contact welding'], 3100],
    ['VFD', 'VFD Drive', 'ATV630', 'Schneider', ['Output short', 'Heatsink overtemp'], 6900],
    ['Servo Drives', 'Servo Motor', 'SGMAH', 'Yaskawa', ['Encoder damage', 'Shaft play'], 5800],
    ['PLC', 'CPU Module', 'S7-1500', 'Siemens', ['STOP mode', 'Memory error'], 8300],
    ['HMI', 'Operator Panel', 'TP1200', 'Siemens', ['Boot failure', 'No display'], 4500],
    ['DC Drives', 'DC Controller', 'DCS880', 'ABB', ['Field fault', 'Bridge failure'], 7700],
  ];
  const panelSamples = [
    ['Distribution Board', 'Distribution Board', 'Custom 16-way', 'Schneider', ['New fabrication'], 24500],
    ['VFD Panel', 'VFD Control Panel', '22 kW Pump Control', 'ABB', ['Panel fabrication', 'Pump automation'], 32000],
    ['MCC Panel', 'Motor Control Center', '6 feeder MCC', 'L&T', ['MCC build', 'Feeder revamp'], 41000],
    ['APFC Panel', 'APFC Relay Panel', '100 kVAR', 'Siemens', ['Capacitor bank', 'PF correction'], 28500],
    ['PCC Panel', 'Power Control Center', '2500A', 'Schneider', ['New build', 'Busbar upgrade'], 56000],
    ['Control Desk', 'Operator Console', 'Custom', 'Siemens', ['Console wiring', 'Mimic build'], 18500],
    ['Junction Boxes', 'Field Junction Box', '24-way GRP', 'Havells', ['New fabrication'], 9500],
    ['PLC Panel', 'PLC Control Panel', 'S7-1500 based', 'Siemens', ['PLC panel', 'Scada prep'], 38500],
    ['Starter Panel', 'Soft Starter Panel', '75 kW', 'ABB', ['Starter panel', 'Pump set'], 27000],
    ['Synchronizing Panel', 'Genset Sync Panel', '2x250 kVA', 'Cummins', ['Sync logic', 'Load share'], 47500],
    ['Feeder Pillar', 'Outdoor Feeder Pillar', '4-way', 'Havells', ['Fabrication', 'IP54 build'], 14000],
    ['Panel Upgrade', 'AMF Panel Retrofit', '100 kVA', 'Kirloskar', ['Retrofit', 'AMF logic'], 22000],
  ];
  const delSamples = [
    ['VFD Drive', 'PowerFlex 525', 'Rockwell', ['Workshop repair intake'], 1800],
    ['Servo Drive', 'Sigma-7', 'Yaskawa', ['Repair return delivery'], 1200],
    ['PLC Module', 'S7-1200', 'Siemens', ['Pickup from plant store'], 1500],
    ['Control Panel', 'MCC spares crate', 'L&T', ['Bulk material shift'], 2200],
    ['HMI Terminal', 'MT8071iP', 'Weintek', ['Rush delivery to workshop'], 1350],
    ['Soft Starter', '3RW44', 'Siemens', ['Return after bench test'], 1100],
    ['VFD Drive', 'ACS580', 'ABB', ['Site handover'], 1650],
    ['Servo Motor', 'SGMAH', 'Yaskawa', ['Intake for encoder job'], 1400],
    ['Breaker Set', 'VCB 11kV spares', 'Siemens', ['Warehouse pickup'], 1900],
    ['Motor', '30 kW rewound', 'ABB', ['Deliver rewound motor'], 2000],
    ['PLC Module', 'ET200SP', 'Siemens', ['Rush replacement part'], 1750],
    ['Panel Parts', 'Busbar kit', 'Schneider', ['Fabrication material run'], 1300],
  ];

  const build = (referencePrefix, targetRole, jobType, list, startIndex) => list.map(([category, equipment, model, brand, tags, pay], index) => {
    const area = areas[(startIndex + index) % areas.length];
    const urgency = urgencyCycle[(startIndex + index) % urgencyCycle.length];
    return {
      referenceId: `${referencePrefix}-${String(index + 1).padStart(2, '0')}`,
      targetRole,
      jobType,
      title: [equipment, model, tags[0]].filter(Boolean).join(' — '),
      category,
      equipment,
      equipmentModel: model,
      brand,
      issueTags: tags,
      urgency,
      siteArea: area[0],
      siteAddress: area[1],
      distanceKm: Math.round((area[2] + index * 0.7) * 10) / 10,
      estimatedDriveMinutes: area[3] + index * 2,
      basePay: pay,
      serviceCharge: pay,
      slaDueAt: hoursFromNow(3 + (index % 9)),
    };
  });

  const sampleJobs = [
    ...build('DEMO-SVC-2026-OPEN', 'service_partner', 'service', svcSamples, 0),
    ...build('DEMO-REP-2026-OPEN', 'repairing_partner', 'repair', repSamples, 2),
    ...build('DEMO-PANEL-2026-OPEN', 'panel_maker', 'panel', panelSamples, 4),
    ...build('DEMO-DEL-2026-OPEN', 'delivery_partner', 'delivery', delSamples, 5),
  ];

  for (const job of sampleJobs) await ensureOpenJob(job);

  const existingDocuments = await DocumentModel.findByUser(servicePartner.id);
  let licenseDocument = existingDocuments.find((document) => document.doc_type === 'driving_license_photo');
  if (!licenseDocument) {
    licenseDocument = await DocumentModel.create({
      userId: servicePartner.id,
      docType: 'driving_license_photo',
      fileName: 'demo-driving-license.jpg',
      fileRef: 'demo://delivery-license',
      mimeType: 'image/jpeg',
      status: 'verified',
    });
  }

  let verification = await DeliveryVerificationModel.findByUser(servicePartner.id);
  if (!verification) {
    verification = await DeliveryVerificationModel.create({
      userId: servicePartner.id,
      vehicleType: 'Bike / Scooter',
      vehicleNumber: 'RJ14 DEMO 01',
      licenseDocumentId: licenseDocument.id,
    });
  }
  if (verification.status !== 'approved') {
    await db.run(
      'UPDATE `delivery_verifications` SET `status` = ?, `updated_at` = ? WHERE `id` = ?',
      ['approved', new Date().toISOString(), verification.id]
    );
  }

  const supplier = rolePartners.supplier;
  const demoProducts = [
    { name: 'MCB 32A Double Pole', category: 'Switchgear', brand: 'Schneider', price: 1450, stock: 28, sku: 'DEMO-MCB-32DP', status: 'active' },
    { name: 'Industrial VFD 5.5 kW', category: 'VFD / Drives', brand: 'ABB', price: 28500, stock: 6, sku: 'DEMO-VFD-55KW', status: 'active' },
    { name: 'XLPE Copper Cable 4 sq mm', category: 'Cables & Wires', brand: 'Polycab', price: 92, stock: 0, sku: 'DEMO-CABLE-4SQ', status: 'out_of_stock' },
    { name: 'Industrial LED High Bay', category: 'Switchgear', brand: 'Havells', price: 3850, stock: 14, sku: 'DEMO-LED-HB', status: 'active' },
    { name: 'Electrical Safety Kit', category: 'Tools & Safety Gear', brand: 'Energy Hub', price: 2200, stock: 3, sku: 'DEMO-SAFETY-KIT', status: 'active' },
    { name: 'Contactor 40A 3-Pole', category: 'Switchgear', brand: 'L&T', price: 2350, stock: 22, sku: 'DEMO-CT-40A', status: 'active' },
    { name: 'Servo Drive 750W', category: 'VFD / Drives', brand: 'Yaskawa', price: 18400, stock: 4, sku: 'DEMO-SERVO-750', status: 'active' },
    { name: 'PLC CPU S7-1200', category: 'PLC / Automation', brand: 'Siemens', price: 21600, stock: 7, sku: 'DEMO-PLC-S71200', status: 'active' },
    { name: 'HMI 7-inch Touch', category: 'PLC / Automation', brand: 'Delta', price: 12800, stock: 9, sku: 'DEMO-HMI-7IN', status: 'active' },
    { name: 'FRLS Copper Cable 2.5 sq mm', category: 'Cables & Wires', brand: 'Havells', price: 58, stock: 120, sku: 'DEMO-CABLE-25SQ', status: 'active' },
    { name: 'MCB Distribution Box 8-way', category: 'Switchgear', brand: 'Legrand', price: 1150, stock: 18, sku: 'DEMO-DB-8W', status: 'active' },
    { name: 'LED Flood Light 150W', category: 'Switchgear', brand: 'Philips', price: 4650, stock: 11, sku: 'DEMO-FL-150W', status: 'active' },
    { name: 'Insulation Tester 1kV', category: 'Tools & Safety Gear', brand: 'Fluke', price: 24500, stock: 2, sku: 'DEMO-IR-1KV', status: 'active' },
    { name: 'Capacitor Duty Contactor 25A', category: 'Switchgear', brand: 'Schneider', price: 1890, stock: 0, sku: 'DEMO-CDC-25A', status: 'out_of_stock' },
    { name: 'APFC Relay 12-Step', category: 'PLC / Automation', brand: 'L&T', price: 7300, stock: 5, sku: 'DEMO-APFC-12', status: 'active' },
  ];
  for (const product of demoProducts) {
    if (await ProductModel.findBySku(supplier.id, product.sku)) continue;
    await SupplierService.createProduct(supplier, {
      ...product,
      description: 'Demonstration catalogue item. Sample data for previewing the app.',
    });
  }

  const existingInventory = await InventoryModel.findByPartner(supplier.id);
  const inventoryItems = [
    { name: 'MCB 32A Double Pole', sku: 'DEMO-MCB-32DP', category: 'Switchgear', quantity: 28, reorderLevel: 8, unitCost: 1100 },
    { name: 'Industrial VFD 5.5 kW', sku: 'DEMO-VFD-55KW', category: 'VFD / Drives', quantity: 6, reorderLevel: 8, unitCost: 24000 },
    { name: 'XLPE Copper Cable 4 sq mm', sku: 'DEMO-CABLE-4SQ', category: 'Cables & Wires', quantity: 0, reorderLevel: 10, unitCost: 75 },
  ];
  for (const item of inventoryItems) {
    if (existingInventory.some((current) => current.sku === item.sku)) continue;
    await InventoryModel.create({ partnerId: supplier.id, ...item });
  }
};

const seedDemoPartner = async () => {
  assertLocalDevelopmentDatabase();
  await db.init();
  if (await JobModel.findByReference('DEMO-SVC-2026-001')) return;

  let partner = await ensureDemoPartner({
    mobile: DEMO_MOBILE,
    email: DEMO_EMAIL,
    role: 'service_partner',
    name: 'Energy Hub Demo Services',
  });
  const rolePartners = {};
  for (const roleDemo of ROLE_DEMOS) {
    rolePartners[roleDemo.role] = await ensureDemoPartner(roleDemo);
  }
  await ensureDemoProfile(partner, {
    role: 'service_partner',
    name: 'Demo Partner',
    experience: '5 – 10 years',
    qualification: 'Diploma — Electrical/Electronics',
    categories: ['Electrician', 'PLC / SCADA', 'VFD / Drives'],
    specializations: {
      skills: ['General Wiring & Repair', 'HT/LT Panel Work', 'VFD Commissioning'],
    },
  });
  await ensureDemoProfile(rolePartners.repairing_partner, {
    role: 'repairing_partner',
    name: 'Demo Repair Workshop',
    experience: '10+ years',
    qualification: 'Other Technical Certification',
    categories: ['VFD', 'PLC', 'Servo Drives'],
    specializations: {
      skills: ['VFD Commissioning', 'PLC Programming', 'Panel Repair'],
      brands: ['ABB', 'Siemens', 'Yaskawa'],
    },
  });
  await ensureDemoProfile(rolePartners.panel_maker, {
    role: 'panel_maker',
    name: 'Demo Panel Works',
    experience: '5 – 10 years',
    qualification: 'ITI — Electrician Trade',
    categories: ['New Starter & MCB Panel', 'VFD Panel', 'Control Panel'],
    specializations: { skills: ['Panel Fabrication', 'Panel Upgrade', 'MCC Maintenance'] },
  });
  await ensureDemoProfile(rolePartners.supplier, {
    role: 'supplier',
    name: 'Demo Electrical Supply',
    experience: '10+ years',
    qualification: 'Other Technical Certification',
    categories: ['Switchgear', 'VFD / Drives', 'Lighting'],
    specializations: { productCategories: ['Switchgear', 'VFD / Drives', 'Lighting'] },
  });

  const activeReference = 'DEMO-SVC-2026-001';
  let activeJob = await JobModel.findByReference(activeReference);
  if (activeJob && String(activeJob.assigned_partner_id) !== String(partner.id)) {
    throw new Error(`Demo reference ${activeReference} already belongs to another partner.`);
  }

  if (!activeJob) {
    const otherActiveJobs = await JobModel.findActiveForPartner(partner.id);
    if (otherActiveJobs.length) {
      throw new Error('The demo partner already has active work; refusing to alter their assignment.');
    }
    if (partner.is_busy) {
      throw new Error('The demo partner is marked busy without the seeded active job; refusing to change its state.');
    }

    await UserModel.setOnline(partner.id, true);
    partner = await UserModel.findById(partner.id);
    activeJob = await JobModel.create({
      referenceId: activeReference,
      jobType: 'service',
      targetRole: 'service_partner',
      title: 'VFD Wiring — Compressor Room',
      description: 'Demonstration work item. This record is sample data.',
      category: 'Electrical',
      equipment: 'VFD Drive',
      equipmentModel: 'ACS580',
      brand: 'ABB',
      issueTags: ['Overcurrent'],
      urgency: 'high',
      customerName: 'Anita Sharma',
      customerCompany: 'Rajasthan Motors',
      customerPhone: '9000000002',
      siteAddress: 'Compressor Room, Vishwakarma Industrial Area, Jaipur',
      siteArea: 'Vishwakarma Industrial Area',
      distanceKm: 2.1,
      estimatedDriveMinutes: 12,
      basePay: 1400,
      serviceCharge: 1600,
      status: 'open',
    });
    await JobService.acceptJob(partner, activeJob.id);
    await WorkflowService.checkIn(partner, activeJob.id);
    activeJob = await JobModel.findById(activeJob.id);
  }
  await db.run('UPDATE `jobs` SET `repair_center_recommended` = ? WHERE `id` = ?', [1, activeJob.id]);

  const completedJobs = [
    { referenceId: 'DEMO-SVC-2026-002', title: 'Panel Inspection — Unit 3', completedDaysAgo: 0, grossAmount: 2055.56, netAmount: 1850 },
    { referenceId: 'DEMO-SVC-2026-003', title: 'Motor Starter Maintenance', completedDaysAgo: 2, grossAmount: 1666.67, netAmount: 1500 },
    { referenceId: 'DEMO-SVC-2026-004', title: 'Electrical Safety Audit', completedDaysAgo: 8, grossAmount: 3333.33, netAmount: 3000 },
    { referenceId: 'DEMO-SVC-2026-005', title: 'APFC Panel Commissioning', completedDaysAgo: 4, grossAmount: 2500, netAmount: 2250 },
    { referenceId: 'DEMO-SVC-2026-006', title: 'HT Breaker Service — Unit 7', completedDaysAgo: 5, grossAmount: 4444.44, netAmount: 4000 },
    { referenceId: 'DEMO-SVC-2026-007', title: 'PLC IO Module Replacement', completedDaysAgo: 9, grossAmount: 2333.33, netAmount: 2100 },
    { referenceId: 'DEMO-SVC-2026-008', title: 'Cooling Tower Fan Alignment', completedDaysAgo: 12, grossAmount: 2777.78, netAmount: 2500 },
    { referenceId: 'DEMO-SVC-2026-009', title: 'Genset Battery & Charger Check', completedDaysAgo: 15, grossAmount: 1666.67, netAmount: 1500 },
    { referenceId: 'DEMO-SVC-2026-010', title: 'DC Drive Fuse & Bridge Repair', completedDaysAgo: 18, grossAmount: 3888.89, netAmount: 3500 },
    { referenceId: 'DEMO-SVC-2026-011', title: 'Distribution Board Tightening Tour', completedDaysAgo: 21, grossAmount: 2222.22, netAmount: 2000 },
    { referenceId: 'DEMO-SVC-2026-012', title: 'Soft Starter Parameter Restore', completedDaysAgo: 26, grossAmount: 2000, netAmount: 1800 },
    { referenceId: 'DEMO-SVC-2026-013', title: 'Motor Winding Resistance Test', completedDaysAgo: 31, grossAmount: 2500, netAmount: 2250 },
    { referenceId: 'DEMO-SVC-2026-014', title: 'Servo Encoder Replacement', completedDaysAgo: 35, grossAmount: 4444.44, netAmount: 4000 },
    { referenceId: 'DEMO-SVC-2026-015', title: 'Control Panel Annual PM Visit', completedDaysAgo: 41, grossAmount: 3055.56, netAmount: 2750 },
  ];
  for (const job of completedJobs) {
    await createCompletedDemoJob(partner, job);
  }

  await db.run(
    `UPDATE \`users\` SET \`rating\` = ?, \`jobs_completed\` = ?, \`updated_at\` = ? WHERE \`id\` = ?`,
    [4.8, 3, new Date().toISOString(), partner.id]
  );

  await seedDemoMarketplace(partner, rolePartners);

  console.log(`Demo sample data created. OTP sign-in: service ${DEMO_MOBILE}, repair ${ROLE_DEMOS[0].mobile}, panel ${ROLE_DEMOS[1].mobile}, supplier ${ROLE_DEMOS[2].mobile}.`);
};

if (require.main === module) {
  seedDemoPartner()
    .catch((error) => {
      console.error('Demo data seeding failed:', error.message);
      process.exitCode = 1;
    })
    .finally(async () => {
      await db.close();
    });
}

module.exports = { seedDemoPartner };
