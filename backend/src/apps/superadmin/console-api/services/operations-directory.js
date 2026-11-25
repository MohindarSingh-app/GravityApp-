const { pool: servicePool } = require('../../../../config/energy_service/db');

const numeric = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const optionalNumeric = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const text = (value) => value === null || value === undefined ? '' : String(value);

const jsonArray = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string' || value.length === 0) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const cityName = (value) => {
  if (!value || typeof value !== 'string') return '—';
  try {
    const address = JSON.parse(value);
    if (address && typeof address.city === 'string') return address.city;
    if (address && typeof address.locality === 'string') return address.locality;
  } catch {
    return '—';
  }
  return '—';
};

const source = (items, sourceStatus = 'connected') => ({ items, sourceStatus });
const providerQuery = async (sql) => (await servicePool.query(sql)).rows;

function jobStatus(row) {
  if (row.status === 'completed') return 'completed';
  const dueAt = row.sla_due_at ? new Date(row.sla_due_at).getTime() : NaN;
  if (Number.isFinite(dueAt) && dueAt < Date.now()) return 'sla-risk';
  return row.assigned_partner_id ? 'progress' : 'unassigned';
}

function jobStage(row) {
  if (row.status === 'completed') return undefined;
  if (row.stage === 'accepted' || row.status === 'accepted') return 'assigned';
  if (row.stage === 'dispatched') return 'scheduled';
  if (row.stage === 'received') return 'on-site';
  return row.assigned_partner_id ? 'assigned' : 'triage';
}

function mapJob(row, activityByJob) {
  const slaDue = row.sla_due_at ? new Date(row.sla_due_at).getTime() : NaN;
  return {
    id: text(row.reference_id || row.id),
    company: text(row.customer_company || row.customer_name) || '—',
    service: text(row.title || row.job_type || row.category) || 'Service job',
    partner: row.partner_business_name || row.partner_name || null,
    status: jobStatus(row),
    slaMinsLeft: Number.isFinite(slaDue)
      ? Math.ceil((slaDue - Date.now()) / 60_000)
      : null,
    amount: numeric(row.total_bill ?? row.payout_amount),
    site: text(row.site_area || row.site_address) || '—',
    category: text(row.category) || undefined,
    priority: ['critical', 'urgent', 'emergency'].includes(String(row.urgency).toLowerCase())
      ? 'critical'
      : ['high'].includes(String(row.urgency).toLowerCase()) ? 'high' : 'normal',
    requester: text(row.customer_name) || undefined,
    contactPhone: text(row.customer_phone) || undefined,
    siteAddress: text(row.site_address) || undefined,
    asset: [row.equipment, row.equipment_model, row.brand].filter(Boolean).map(text).join(' · ') || undefined,
    issue: text(row.description) || undefined,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : undefined,
    scheduledAt: row.scheduled_at ? new Date(row.scheduled_at).toISOString() : undefined,
    stage: jobStage(row),
    checklist: jsonArray(row.checklist).map((item, index) => ({
      id: text(item.id || item.key || `check-${index + 1}`),
      label: text(item.label || item.name || item.title),
      done: item.done === true || item.completed === true,
    })).filter((item) => item.label),
    activity: activityByJob.get(String(row.id)) || [],
  };
}

async function getJobs() {
  const [rows, activityRows, partnerRows] = await Promise.all([
    providerQuery(
      `SELECT job.id, job.reference_id, job.job_type, job.title, job.description, job.category,
              job.equipment, job.equipment_model, job.brand, job.urgency, job.customer_name,
              job.customer_company, job.customer_phone, job.site_address, job.site_area,
              job.total_bill, job.payout_amount, job.status, job.stage, job.assigned_partner_id,
              job.scheduled_at, job.sla_due_at, job.checklist, job.created_at, job.updated_at,
              partner.full_name AS partner_name, partner.business_name AS partner_business_name
         FROM energy_provider.jobs job
         LEFT JOIN energy_provider.users partner ON partner.id = job.assigned_partner_id
        ORDER BY job.created_at DESC, job.id DESC`,
    ),
    providerQuery(
      `SELECT job_id, from_stage, to_stage, created_at
         FROM energy_provider.job_stage_history
        ORDER BY created_at`,
    ),
    getPartners(),
  ]);
  const activityByJob = new Map();
  for (const row of activityRows) {
    const key = String(row.job_id);
    const entries = activityByJob.get(key) || [];
    entries.push({
      at: row.created_at ? new Date(row.created_at).toISOString() : '',
      title: 'Job stage updated',
      detail: `${text(row.from_stage) || 'Status'} → ${text(row.to_stage)}`,
    });
    activityByJob.set(key, entries);
  }
  return {
    jobs: rows.map((row) => mapJob(row, activityByJob)),
    partners: partnerRows.items,
    sourceStatus: 'connected',
  };
}

async function getPartners() {
  const rows = await providerQuery(
    `SELECT partner.id, partner.full_name, partner.business_name, partner.role, partner.status,
            partner.rating, partner.jobs_completed, partner.is_online, partner.address
       FROM energy_provider.users partner
      WHERE partner.role IS NOT NULL AND partner.role <> 'admin'
      ORDER BY partner.full_name, partner.id`,
  );
  return source(rows.map((row) => ({
    id: String(row.id),
    name: text(row.business_name || row.full_name) || `Partner ${row.id}`,
    type: String(row.role).toLowerCase().includes('repair') ? 'repairing'
      : String(row.role).toLowerCase().includes('panel') ? 'panelmaker'
        : String(row.role).toLowerCase().includes('supplier') ? 'supplier' : 'service',
    rating: numeric(row.rating),
    jobsDone: numeric(row.jobs_completed),
    online: row.is_online === true || row.is_online === 1,
    verified: row.status === 'active' || row.status === 'approved',
    city: cityName(row.address),
  })));
}

async function getPartnerRoleCounts() {
  const rows = await providerQuery(
    `SELECT role, COUNT(*)::int AS count
       FROM energy_provider.users
      WHERE role IS NOT NULL AND role <> 'admin'
      GROUP BY role`,
  );
  const categories = {
    service: ['service', 'service_partner'],
    repairing: ['repairing', 'repairing_partner'],
    panelmaker: ['panelmaker', 'panel_maker'],
    supplier: ['supplier'],
  };
  const counts = new Map(rows.map((row) => [String(row.role).toLowerCase(), numeric(row.count)]));
  return source(Object.entries(categories).map(([type, roles]) => ({
    type,
    count: roles.reduce((total, role) => total + (counts.get(role) ?? 0), 0),
  })));
}

async function getVerifications() {
  const rows = await providerQuery(
    `SELECT application.id, application.partner_role, application.submitted_at,
            partner.full_name, partner.business_name,
            COALESCE(
              json_agg(DISTINCT document.doc_type)
                FILTER (WHERE document.doc_type IS NOT NULL),
              '[]'::json
            ) AS documents
       FROM energy_provider.partner_applications application
       JOIN energy_provider.users partner ON partner.id = application.user_id
       LEFT JOIN energy_provider.partner_documents document ON document.application_id = application.id
      WHERE application.status IN ('submitted', 'pending', 'under_review')
      GROUP BY application.id, partner.full_name, partner.business_name
      ORDER BY application.submitted_at DESC NULLS LAST, application.id DESC`,
  );
  return source(rows.map((row) => ({
    id: String(row.id),
    name: text(row.business_name || row.full_name) || `Application ${row.id}`,
    type: text(row.partner_role) || 'Partner',
    documents: jsonArray(row.documents).map(text).filter(Boolean),
    appliedAt: row.submitted_at ? new Date(row.submitted_at).toISOString() : '',
  })));
}

async function getCompanies() {
  const result = await servicePool.query(
    `SELECT company.id, company.company_name, company.gst_number, company.status,
            (SELECT COUNT(*)::int FROM sites site WHERE site.company_id = company.id) AS sites,
            (SELECT COUNT(*)::int FROM users member WHERE member.company_id = company.id) AS users,
            (SELECT COUNT(*)::int FROM energy_provider.jobs job
              WHERE LOWER(TRIM(job.customer_company)) = LOWER(TRIM(company.company_name))) AS total_jobs,
            COALESCE((
              SELECT SUM(order_row.total)
                FROM orders order_row
               WHERE order_row.company_id = company.id AND order_row.status <> 'cancelled'
            ), 0) +
            COALESCE((
              SELECT SUM(earning.gross_amount)
                FROM energy_provider.jobs job
                JOIN energy_provider.earnings earning ON earning.job_id = job.id
               WHERE LOWER(TRIM(job.customer_company)) = LOWER(TRIM(company.company_name))
            ), 0) AS revenue,
            (SELECT contract.status FROM amc_contracts contract
              WHERE contract.company_id = company.id
              ORDER BY contract.end_date DESC NULLS LAST LIMIT 1) AS amc_status,
            (SELECT contract.end_date FROM amc_contracts contract
              WHERE contract.company_id = company.id
              ORDER BY contract.end_date DESC NULLS LAST LIMIT 1) AS amc_end_date
       FROM companies company
      ORDER BY company.company_name, company.id`,
  );
  return source(result.rows.map((row) => {
    const daysLeft = row.amc_end_date
      ? Math.ceil((new Date(row.amc_end_date).getTime() - Date.now()) / 86_400_000)
      : null;
    const amc = row.amc_status !== 'active' ? 'None'
      : daysLeft !== null && daysLeft <= 30 ? 'Expiring' : 'Active';
    return {
      name: text(row.company_name),
      gst: text(row.gst_number),
      sites: numeric(row.sites),
      users: numeric(row.users),
      amc,
      totalJobs: numeric(row.total_jobs),
      revenue: numeric(row.revenue),
    };
  }));
}

async function getAmcs() {
  const result = await servicePool.query(
    `SELECT contract.id, contract.contract_number, contract.contract_type, contract.coverage,
            contract.end_date, contract.status, contract.company_id, company.company_name
       FROM amc_contracts contract
       LEFT JOIN companies company ON company.id = contract.company_id
      ORDER BY contract.end_date ASC NULLS LAST, contract.id`,
  );
  return source(result.rows.map((row) => {
    const endDate = row.end_date ? new Date(row.end_date) : null;
    return {
      id: text(row.contract_number || row.id),
      company: text(row.company_name) || '—',
      plan: [row.contract_type, row.coverage].filter(Boolean).map(text).join(' — ') || 'AMC',
      expires: endDate ? endDate.toISOString().slice(0, 10) : '',
      daysLeft: endDate ? Math.ceil((endDate.getTime() - Date.now()) / 86_400_000) : 0,
      compliance: text(row.status) || 'Unknown',
      value: null,
    };
  }));
}

async function getPayouts() {
  const rows = await providerQuery(
    `SELECT earning.id, earning.partner_id, earning.job_id, earning.net_amount,
            earning.status, earning.created_at, partner.full_name, partner.business_name
       FROM energy_provider.earnings earning
       LEFT JOIN energy_provider.users partner ON partner.id = earning.partner_id
      ORDER BY earning.created_at DESC, earning.id DESC`,
  );
  return source(rows.map((row) => ({
    id: String(row.id),
    partner: text(row.business_name || row.full_name) || `Partner ${row.partner_id}`,
    period: row.created_at ? new Date(row.created_at).toISOString().slice(0, 10) : '',
    jobs: row.job_id ? 1 : 0,
    amount: numeric(row.net_amount),
    status: row.status === 'paid' ? 'paid' : 'pending',
  })));
}

async function getInventory() {
  const rows = await providerQuery(
    `SELECT id, name, sku, category, quantity, reorder_level
       FROM energy_provider.inventory_items
      ORDER BY name, id`,
  );
  return source(rows.map((row) => ({
    sku: text(row.sku || row.id),
    name: text(row.name),
    category: text(row.category),
    stock: numeric(row.quantity),
    low: numeric(row.reorder_level),
    supplier: '—',
  })));
}

async function getRepairs() {
  const result = await servicePool.query(
    `SELECT ticket.id, ticket.ticket_number, ticket.repair_scope, ticket.service_type,
            ticket.status, ticket.submitted_at, ticket.created_at, device.name AS device_name
       FROM repair_tickets ticket
       LEFT JOIN (
         SELECT id, CONCAT_WS(' ', manufacturer, model) AS name
           FROM devices
       ) device ON device.id = ticket.device_id
      ORDER BY ticket.created_at DESC, ticket.id DESC`,
  );
  return source(result.rows.map((row) => ({
    id: text(row.ticket_number || row.id),
    device: text(row.device_name || row.repair_scope || row.service_type) || 'Repair ticket',
    partner: '—',
    stage: ['delivered', 'completed'].includes(String(row.status).toLowerCase()) ? 'delivered'
      : ['qc', 'quality_check'].includes(String(row.status).toLowerCase()) ? 'qc'
        : ['repairing', 'in_progress'].includes(String(row.status).toLowerCase()) ? 'repairing'
          : ['diagnosis', 'diagnosing'].includes(String(row.status).toLowerCase()) ? 'diagnosis' : 'received',
    inAt: row.submitted_at || row.created_at
      ? new Date(row.submitted_at || row.created_at).toISOString()
      : '',
    cost: null,
  })));
}

async function getProjects() {
  const result = await servicePool.query(
    `SELECT request.id, request.request_number, request.title, request.estimated_scope,
            request.preferred_timeline, request.budget_amount, request.status,
            company.company_name
       FROM project_requests request
       LEFT JOIN companies company ON company.id = request.company_id
      ORDER BY request.created_at DESC, request.id DESC`,
  );
  return source(result.rows.map((row) => ({
    id: text(row.request_number || row.id),
    company: text(row.company_name) || '—',
    title: text(row.title) || 'Project request',
    panels: text(row.estimated_scope) || '—',
    status: ['delivered', 'completed'].includes(String(row.status).toLowerCase())
      ? 'delivered'
      : ['in-production', 'in_production', 'processing'].includes(String(row.status).toLowerCase())
        ? 'in-production' : 'requested',
    eta: text(row.preferred_timeline) || '—',
    value: optionalNumeric(row.budget_amount),
  })));
}

async function getAnalytics() {
  const [jobs, payments, repairs, amcs, projects] = await Promise.all([
    providerQuery(
      `SELECT job.created_at AS at, COALESCE(SUM(earning.gross_amount), 0) AS amount,
              'service' AS category
         FROM energy_provider.jobs job
         LEFT JOIN energy_provider.earnings earning ON earning.job_id = job.id
        WHERE job.created_at IS NOT NULL
        GROUP BY job.id, job.created_at`,
    ),
    servicePool.query(
      `SELECT created_at AS at, amount, 'ecart' AS category
         FROM payments
        WHERE status = 'succeeded' AND created_at IS NOT NULL`,
    ),
    servicePool.query(
      `SELECT created_at AS at, 0::numeric AS amount, 'repair' AS category
         FROM repair_tickets WHERE created_at IS NOT NULL`,
    ),
    servicePool.query(
      `SELECT created_at AS at, 0::numeric AS amount, 'amc' AS category
         FROM amc_contracts WHERE created_at IS NOT NULL`,
    ),
    servicePool.query(
      `SELECT created_at AS at, 0::numeric AS amount, 'projects' AS category
         FROM project_requests WHERE created_at IS NOT NULL`,
    ),
  ]);
  const events = [
    ...jobs,
    ...payments.rows,
    ...repairs.rows,
    ...amcs.rows,
    ...projects.rows,
  ].map((row) => ({
    at: row.at ? new Date(row.at).toISOString() : '',
    amount: numeric(row.amount),
    category: row.category,
  })).filter((row) => row.at);
  return source(events);
}

const readers = {
  jobs: getJobs,
  livemonitor: getJobs,
  'partner-app': getPartnerRoleCounts,
  verification: getVerifications,
  disputes: async () => ({
    ...source([], 'not-connected'),
    message: 'No connected disputes data source is configured.',
  }),
  companies: getCompanies,
  amc: getAmcs,
  finance: getPayouts,
  invoices: async () => ({ ...source([], 'not-connected'), message: 'No invoice table or API is connected.' }),
  inventory: getInventory,
  repair: getRepairs,
  projects: getProjects,
  analytics: getAnalytics,
};

function createOperationsDirectory() {
  return {
    async getData(domain) {
      const reader = readers[domain];
      return reader ? reader() : null;
    },
  };
}

module.exports = { createOperationsDirectory };
