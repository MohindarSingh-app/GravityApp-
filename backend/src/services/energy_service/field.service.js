const crypto = require('crypto');
const AppError = require('../../utils/energy_service/AppError');
const { can, canAccessCompany } = require('./rbac.service');
const fieldModel = require('../../models/energy_service/field.model');
const siteModel = require('../../models/energy_service/site.model');
const repairModel = require('../../models/energy_service/customer/repair.model');
const amcModel = require('../../models/energy_service/customer/amc.model');
const attachmentModel = require('../../models/energy_service/customer/attachment.model');
const auditService = require('./audit.service');
const attachmentSupport = require('./customer/support');
const customerPresenters = require('./customer/presenters');
const { withTransaction } = require('../../utils/energy_service/transaction');

const OPEN_STATUSES = new Set(['open', 'accepted', 'on_the_way', 'in_progress']);
const JOB_TRANSITIONS = {
  open: new Set(['accepted', 'cancelled']),
  accepted: new Set(['on_the_way', 'in_progress', 'cancelled']),
  on_the_way: new Set(['in_progress', 'completed', 'cancelled']),
  in_progress: new Set(['completed', 'cancelled']),
  completed: new Set(),
  cancelled: new Set(),
};

function requireCompany(user) {
  if (!user.company_id || !canAccessCompany(user, user.company_id)) {
    throw new AppError('Create a company before using field tools.', 409, 'COMPANY_REQUIRED');
  }
  return user.company_id;
}

function jobCode() {
  return `EC-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

function toJob(row) {
  if (!row) return null;
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    category: row.category,
    priority: row.priority,
    status: row.status,
    location: row.location_label || '',
    engineerName: row.engineer_name || '',
    engineerTrade: row.engineer_trade || '',
    rating: row.rating === null || row.rating === undefined ? null : Number(row.rating),
    estimateAmount: row.estimate_amount,
    slaDueAt: row.sla_due_at,
    etaMinutes: row.eta_minutes,
    notes: row.notes || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at || row.created_at,
  };
}

function toSignal(row) {
  if (!row) return null;
  return {
    id: row.id,
    jobId: row.job_id || null,
    jobCode: row.job_code || null,
    jobTitle: row.job_title || null,
    jobCreatedAt: row.job_created_at || null,
    jobEngineerName: row.job_engineer_name || null,
    jobEngineerTrade: row.job_engineer_trade || null,
    jobEngineerRating: row.job_engineer_rating == null ? null : Number(row.job_engineer_rating),
    siteId: row.site_id || null,
    deviceId: row.device_id || null,
    deviceSiteId: row.device_site_id || null,
    deviceType: row.device_type || null,
    manufacturer: row.manufacturer || null,
    model: row.model || null,
    serialNumber: row.serial_number || null,
    powerRating: row.power_rating || null,
    installationLocation: row.installation_location || null,
    kind: row.kind,
    title: row.title,
    detail: row.detail,
    status: row.status,
    etaMinutes: row.eta_minutes,
    actorName: row.actor_name || '',
    issuesFound: row.issues_found || [],
    errorCode: row.error_code || null,
    riskNote: row.risk_note || null,
    scopeCosts: row.scope_costs || {},
    createdAt: row.created_at,
  };
}

async function presentSignal(row, client) {
  const signal = toSignal(row);
  if (!signal || signal.kind !== 'recommendation') return signal;
  const attachments = await attachmentModel.listByEntity(
    row.company_id,
    'field_signal',
    row.id,
    client,
  );
  signal.attachments = attachments.map(customerPresenters.attachment);
  return signal;
}

function toAmc(row) {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    discountPercent: row.discount_percent,
    quoteHours: row.quote_hours,
    coverage: row.coverage,
    priorityResponse: row.priority_response,
    createdAt: row.created_at,
  };
}

function certStatus(expiresAt, now) {
  const time = new Date(expiresAt).getTime();
  if (time <= now) return 'expired';
  if (time <= now + (30 * 24 * 60 * 60 * 1000)) return 'expiring';
  return 'valid';
}

function toCert(row, now) {
  return {
    id: row.id,
    name: row.name,
    expiresAt: row.expires_at,
    status: certStatus(row.expires_at, now),
  };
}

async function locationFor(companyId, siteId) {
  if (!siteId) return '';
  const site = await siteModel.findById(siteId);
  if (!site || site.company_id !== companyId) {
    throw new AppError('That site is not on this company.', 422, 'INVALID_SITE');
  }
  return [site.site_name, site.city].filter(Boolean).join(', ');
}

async function snapshot(user, access) {
  const empty = {
    place: '',
    alertCount: 0,
    emergency: null,
    recommendation: null,
    transit: null,
    repair: null,
    metrics: { activeJobs: 0, slaRisk: 0, amcActive: 0, certsExpiring: 0 },
    services: [],
    products: null,
    amc: { active: 0, quoted: 0, plans: [] },
    certs: [],
    jobs: [],
  };
  if (!user.company_id) return empty;
  const companyId = user.company_id;
  const now = Date.now();
  const [jobs, counts, signals] = await Promise.all([
    fieldModel.listJobs(companyId),
    fieldModel.countJobs(companyId),
    fieldModel.latestOpenSignals(companyId, ['emergency', 'recommendation', 'transit', 'repair_send_in']),
  ]);
  const [amcRows, certRows, services] = await Promise.all([
    fieldModel.listAmc(companyId),
    fieldModel.listCerts(companyId),
    fieldModel.listCatalog(),
  ]);
  const [spares, sites] = await Promise.all([
    access.readMarketplace ? fieldModel.listSpares() : Promise.resolve(null),
    siteModel.listByCompany(companyId),
  ]);
  const activeAmcContracts = await amcModel.countActiveContracts(companyId);
  const emergency = signals.emergency || null;
  const recommendation = signals.recommendation || null;
  const transit = signals.transit || null;
  const repair = signals.repair_send_in || null;
  const primary = sites.find((site) => site.is_primary) || sites[0];
  let liveJobRecord = transit && transit.job_id
    ? jobs.find((job) => String(job.id) === String(transit.job_id))
    : null;
  if (transit && transit.job_id && !liveJobRecord) {
    liveJobRecord = await fieldModel.findJob(transit.job_id, companyId);
  }
  if (!liveJobRecord && !transit) {
    liveJobRecord = jobs.find((job) => job.status === 'on_the_way') || null;
  }
  const certs = certRows.map((row) => toCert(row, now));
  const plans = amcRows.map(toAmc);
  const recommendationRecord = recommendation ? await presentSignal(recommendation) : null;
  return {
    place: primary ? [primary.site_name, primary.city].filter(Boolean).join(', ') : '',
    alertCount: [emergency, recommendation].filter(Boolean).length
      + Number(Boolean(transit || liveJobRecord))
      + Number(counts.sla_risk || 0),
    emergency: toSignal(emergency) || {
      title: 'Emergency Service',
      detail: 'Machine down? Technician in 30 min',
    },
    recommendation: recommendationRecord,
    transit: toSignal(transit),
    liveJob: transit ? {
      jobId: transit.job_id || null,
      job: toJob(liveJobRecord),
      title: [transit.actor_name, transit.title].filter(Boolean).join(' — ') || transit.title,
      etaMinutes: transit.eta_minutes,
      location: liveJobRecord ? liveJobRecord.location_label || '' : '',
    } : liveJobRecord ? {
      jobId: liveJobRecord.id,
      job: toJob(liveJobRecord),
      title: [liveJobRecord.engineer_name, 'is on the way'].filter(Boolean).join(' ')
        || 'Specialist is on the way',
      etaMinutes: liveJobRecord.eta_minutes,
      location: liveJobRecord.location_label || '',
    } : null,
    repair: access.createRepairs ? toSignal(repair) : null,
    metrics: {
      activeJobs: counts.active || 0,
      slaRisk: counts.sla_risk || 0,
      amcActive: activeAmcContracts,
      certsExpiring: certs.filter((cert) => cert.status !== 'valid').length,
    },
    services: services.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      category: row.category,
      summary: row.summary,
      sameDay: row.same_day,
    })),
    products: spares ? spares.map((row) => ({
      id: row.id,
      sku: row.sku,
      name: row.name,
      summary: row.summary,
    })) : null,
    amc: {
      active: activeAmcContracts,
      quoted: plans.filter((plan) => plan.status === 'quoted').length,
      plans,
    },
    certs,
    jobs: jobs.map(toJob),
  };
}

async function listJobs(user) {
  const companyId = requireCompany(user);
  const rows = await fieldModel.listJobs(companyId);
  return { jobs: rows.map(toJob) };
}

async function createJob(user, input, req, options = {}) {
  if (!can(user.role, 'jobs.create')) {
    throw new AppError('You do not have access to this area.', 403, 'FORBIDDEN');
  }
  const companyId = requireCompany(user);
  const location = await locationFor(companyId, input.siteId);
  const priority = input.priority || 'scheduled';
  const emergencyMinutes = input.slaMinutes || 30;
  const slaDueAt = new Date(Date.now() + (priority === 'emergency' ? emergencyMinutes : 24 * 60) * 60 * 1000);
  const create = async (client) => {
    const job = await fieldModel.insertJob({
      companyId,
      siteId: input.siteId,
      code: jobCode(),
      title: input.title,
      category: input.category || 'job',
      priority,
      locationLabel: location,
      slaDueAt,
      etaMinutes: priority === 'emergency' ? emergencyMinutes : null,
      notes: input.notes,
    }, client);
    let signal = null;
    if (priority === 'emergency') {
      signal = await fieldModel.insertSignal({
        companyId,
        siteId: input.siteId,
        jobId: job.id,
        kind: 'emergency',
        title: input.title,
        detail: input.notes || 'Emergency visit requested.',
        etaMinutes: emergencyMinutes,
        actorName: user.name || '',
      }, client);
    }
    if (input.attachmentIds && input.attachmentIds.length) {
      if (!signal) {
        throw new AppError('Photos can only be attached to emergency requests.', 422, 'VALIDATION_ERROR');
      }
      await attachmentSupport.linkAttachments(client, {
        companyId,
        entityType: 'field_signal',
        entityId: signal.id,
        attachmentIds: input.attachmentIds,
      });
    }
    return { job, signal };
  };
  const { job, signal } = input.attachmentIds && input.attachmentIds.length
    ? await withTransaction(create)
    : await create(null);
  await auditService.createAuditLog({
    userId: user.id,
    companyId,
    action: 'job.created',
    entityType: 'field_job',
    entityId: job.id,
    description: 'Job created',
    req,
  });
  const result = { job: toJob(job) };
  if (options.includeSignal) result.signal = signal ? toSignal(signal) : null;
  return result;
}

async function setJobStatus(user, jobId, input, req) {
  if (!can(user.role, 'jobs.update')) {
    throw new AppError('You do not have access to this area.', 403, 'FORBIDDEN');
  }
  const companyId = requireCompany(user);
  const existing = await fieldModel.findJob(jobId, companyId);
  if (!existing) throw new AppError('Job not found.', 404, 'NOT_FOUND');
  if (!OPEN_STATUSES.has(existing.status) && input.status !== existing.status) {
    throw new AppError('This job is already closed.', 409, 'JOB_CLOSED');
  }
  const allowed = JOB_TRANSITIONS[existing.status];
  if (!allowed || !allowed.has(input.status)) {
    throw new AppError('That job status change is not allowed.', 409, 'INVALID_JOB_TRANSITION', {
      from: existing.status,
      to: input.status,
    });
  }
  const eta = input.status === 'on_the_way' ? (input.etaMinutes || 30) : null;
  const job = await fieldModel.updateJobStatus(jobId, companyId, input.status, eta);
  if (input.status === 'on_the_way') {
    await fieldModel.closeTransit(companyId);
    await fieldModel.insertSignal({
      companyId,
      siteId: job.site_id,
      jobId: job.id,
      kind: 'transit',
      title: `${user.name || 'Engineer'} is on the way`,
      detail: job.title,
      etaMinutes: eta,
      actorName: user.name || '',
    });
  }
  if (input.status === 'completed' || input.status === 'cancelled') {
    await fieldModel.closeTransit(companyId);
  }
  await auditService.createAuditLog({
    userId: user.id,
    companyId,
    action: 'job.status_changed',
    entityType: 'field_job',
    entityId: job.id,
    description: 'Job status changed',
    req,
    metadata: { status: input.status },
  });
  return { job: toJob(job) };
}

async function listSignals(user, kind) {
  const companyId = requireCompany(user);
  const rows = await fieldModel.listSignals(companyId, kind || null);
  return { signals: await Promise.all(rows.map((row) => presentSignal(row))) };
}

async function createSignal(user, input, req) {
  const repairKinds = new Set(['recommendation', 'repair_send_in']);
  const allowed = repairKinds.has(input.kind)
    ? can(user.role, 'repairs.create')
    : can(user.role, 'signals.create');
  if (!allowed) throw new AppError('You do not have access to this area.', 403, 'FORBIDDEN');
  const companyId = requireCompany(user);
  await locationFor(companyId, input.siteId);
  if (input.kind === 'recommendation') {
    return withTransaction(async (client) => {
      const site = await attachmentSupport.assertSite(companyId, input.siteId, client);
      const [job, device] = await Promise.all([
        fieldModel.findJob(input.jobId, companyId, client),
        repairModel.findDevice(input.deviceId, companyId, client),
      ]);
      if (!job) throw new AppError('The linked job was not found.', 422, 'INVALID_JOB');
      if (!device) throw new AppError('The linked device was not found.', 422, 'INVALID_DEVICE');
      if (job.site_id !== site.id || device.site_id !== site.id) {
        throw new AppError('The job, device, and recommendation must use the same site.', 422, 'SITE_MISMATCH');
      }

      const signal = await fieldModel.insertSignal({
        companyId,
        siteId: site.id,
        jobId: job.id,
        deviceId: device.id,
        kind: input.kind,
        title: input.title,
        detail: input.detail,
        issuesFound: input.issuesFound,
        errorCode: input.errorCode,
        riskNote: input.riskNote,
        scopeCosts: input.scopeCosts,
        actorName: user.name || '',
      }, client);
      await attachmentSupport.linkAttachments(client, {
        companyId,
        entityType: 'field_signal',
        entityId: signal.id,
        attachmentIds: input.attachmentIds,
      });
      await auditService.createAuditLog({
        userId: user.id,
        companyId,
        siteId: site.id,
        action: 'signal.created',
        entityType: 'field_signal',
        entityId: signal.id,
        description: 'Repair recommendation created',
        req,
        client,
      });
      const saved = await fieldModel.findSignal(signal.id, companyId, client);
      return { signal: await presentSignal(saved, client) };
    });
  }
  if (input.kind === 'emergency') {
    const created = await createJob(user, {
      title: input.title,
      notes: input.detail,
      siteId: input.siteId,
      category: 'job',
      priority: 'emergency',
      slaMinutes: input.etaMinutes,
      attachmentIds: input.attachmentIds,
    }, req, { includeSignal: true });
    return { signal: created.signal, job: created.job };
  }
  const signal = await fieldModel.insertSignal({
    companyId,
    siteId: input.siteId,
    kind: input.kind,
    title: input.title,
    detail: input.detail,
    etaMinutes: input.kind === 'emergency' ? (input.etaMinutes || 30) : input.etaMinutes,
    actorName: user.name || '',
  });
  await auditService.createAuditLog({
    userId: user.id,
    companyId,
    action: 'signal.created',
    entityType: 'field_signal',
    entityId: signal.id,
    description: 'Field signal created',
    req,
    metadata: { kind: input.kind },
  });
  return { signal: toSignal(signal) };
}

async function listAmc(user) {
  const companyId = requireCompany(user);
  const rows = await fieldModel.listAmc(companyId);
  return { plans: rows.map(toAmc) };
}

async function createAmc(user, input, req) {
  if (!can(user.role, 'amc.quote')) {
    throw new AppError('You do not have access to this area.', 403, 'FORBIDDEN');
  }
  const companyId = requireCompany(user);
  await locationFor(companyId, input.siteId);
  const plan = await fieldModel.insertAmc({
    companyId,
    siteId: input.siteId,
    title: input.title,
    coverage: input.coverage,
    discountPercent: input.discountPercent,
    quoteHours: 48,
  });
  await auditService.createAuditLog({
    userId: user.id,
    companyId,
    action: 'amc.quoted',
    entityType: 'amc_plan',
    entityId: plan.id,
    description: 'AMC quote requested',
    req,
  });
  return { plan: toAmc(plan) };
}

async function listCerts(user) {
  const companyId = requireCompany(user);
  const now = Date.now();
  const rows = await fieldModel.listCerts(companyId);
  return { certs: rows.map((row) => toCert(row, now)) };
}

async function createCert(user, input, req) {
  if (!can(user.role, 'certs.manage')) {
    throw new AppError('You do not have access to this area.', 403, 'FORBIDDEN');
  }
  const companyId = requireCompany(user);
  await locationFor(companyId, input.siteId);
  const cert = await fieldModel.insertCert({
    companyId,
    siteId: input.siteId,
    name: input.name,
    expiresAt: new Date(input.expiresAt),
  });
  await auditService.createAuditLog({
    userId: user.id,
    companyId,
    action: 'cert.created',
    entityType: 'compliance_cert',
    entityId: cert.id,
    description: 'Certificate recorded',
    req,
  });
  return { cert: toCert(cert, Date.now()) };
}

async function listCatalog() {
  const rows = await fieldModel.listCatalog();
  return {
    services: rows.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      category: row.category,
      summary: row.summary,
      sameDay: row.same_day,
    })),
  };
}

async function listProducts(user) {
  if (!can(user.role, 'marketplace.read')) {
    throw new AppError('You do not have access to this area.', 403, 'FORBIDDEN');
  }
  const rows = await fieldModel.listSpares();
  return {
    products: rows.map((row) => ({
      id: row.id,
      sku: row.sku,
      name: row.name,
      summary: row.summary,
    })),
  };
}

module.exports = {
  snapshot,
  listJobs,
  createJob,
  setJobStatus,
  listSignals,
  createSignal,
  listAmc,
  createAmc,
  listCerts,
  createCert,
  listCatalog,
  listProducts,
};
