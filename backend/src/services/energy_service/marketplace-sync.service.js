const AppError = require('../../utils/energy_service/AppError');

const SERVICE_REFERENCE_PREFIX = 'SA-';
const CATALOG_CATEGORIES = {
  panel: 'Switchgear',
  plc: 'PLC / Automation',
  cabling: 'Cables & Wires',
  install: 'Electrical',
  workshop: 'VFD / Drives',
};

function isUnifiedServer() {
  return process.env.UNIFIED_SERVER === '1';
}

function isPublishedReference(referenceId) {
  return typeof referenceId === 'string' && referenceId.startsWith(SERVICE_REFERENCE_PREFIX);
}

function marketplaceCategory(catalogCode) {
  return CATALOG_CATEGORIES[catalogCode] || 'Electrical';
}

async function publishJob(client, { job, companyId, siteId, input, priority }) {
  if (!isUnifiedServer()) return false;

  const companyResult = await client.query(
    'SELECT company_name, city FROM companies WHERE id = $1',
    [companyId],
  );
  const company = companyResult.rows[0];
  if (!company) throw new Error('The company for this Service Admin job was not found.');

  let site = null;
  if (siteId) {
    const siteResult = await client.query(
      `SELECT site_name, address, city, state, country, pincode
       FROM sites
       WHERE id = $1 AND company_id = $2`,
      [siteId, companyId],
    );
    site = siteResult.rows[0] || null;
    if (!site) throw new Error('The site for this Service Admin job was not found.');
  }

  const category = marketplaceCategory(input.catalogCode);
  const siteAddress = site
    ? [site.address, site.city, site.state, site.pincode].filter(Boolean).join(', ')
    : '';
  const siteArea = site ? site.city : company.city || '';
  await client.query(
    `INSERT INTO energy_provider.jobs (
       reference_id, job_type, target_role, title, description, category,
       issue_tags, urgency, customer_name, customer_company, site_address,
       site_area, base_pay, service_charge, status, sla_due_at, created_at, updated_at
     )
     VALUES (
       $1, 'service', 'service_partner', $2, $3, $4,
       $5::json, $6, $7, $7, $8, $9, 0, 0, 'open', $10, $11, $11
     )`,
    [
      `${SERVICE_REFERENCE_PREFIX}${job.code}`,
      job.title,
      input.notes || '',
      category,
      JSON.stringify([category]),
      priority === 'emergency' ? 'urgent' : 'medium',
      company.company_name,
      siteAddress,
      siteArea,
      job.sla_due_at,
      job.created_at,
    ],
  );
  return true;
}

async function cancelUnclaimedJob(client, code) {
  if (!isUnifiedServer()) return false;
  const result = await client.query(
    `UPDATE energy_provider.jobs
     SET status = 'cancelled', updated_at = NOW()
     WHERE reference_id = $1 AND status = 'open'
     RETURNING id`,
    [`${SERVICE_REFERENCE_PREFIX}${code}`],
  );
  if (!result.rowCount) {
    throw new AppError(
      'This request is controlled by its Energy Hub partner and can no longer be cancelled from Service Admin.',
      409,
      'MARKETPLACE_JOB_CLAIMED',
    );
  }
  return true;
}

module.exports = {
  SERVICE_REFERENCE_PREFIX,
  isUnifiedServer,
  isPublishedReference,
  marketplaceCategory,
  publishJob,
  cancelUnclaimedJob,
};
