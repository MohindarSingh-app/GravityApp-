const AppError = require('../../utils/energy_service/AppError');
const { withTransaction } = require('../../utils/energy_service/transaction');
const { ONBOARDING, deriveOnboardingStatus } = require('../../constants/energy_service/onboarding');
const siteModel = require('../../models/energy_service/site.model');
const companyModel = require('../../models/energy_service/company.model');
const userModel = require('../../models/energy_service/user.model');
const rbacService = require('./rbac.service');
const auditService = require('./audit.service');

const TYPE_LABEL = {
  factory: 'Factory',
  plant: 'Plant',
  warehouse: 'Warehouse',
  office: 'Office',
  other: 'Other',
};

function toPublicSite(row) {
  return {
    id: row.id,
    companyId: row.company_id,
    siteName: row.site_name,
    address: row.address,
    fullAddress: row.address,
    city: row.city,
    state: row.state,
    country: row.country,
    pincode: row.pincode,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    siteType: row.site_type,
    siteTypeLabel: TYPE_LABEL[row.site_type] || row.site_type,
    isPrimary: row.is_primary,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeSiteType(value) {
  return String(value || '').trim().toLowerCase();
}

async function assertCompanyAccess(user, companyId, { requireActive = false } = {}) {
  if (!rbacService.canAccessCompany(user, companyId)) {
    throw new AppError('You do not have access to this company.', 403, 'FORBIDDEN');
  }
  const company = await companyModel.findById(companyId);
  if (!company) throw new AppError('Company not found.', 404, 'NOT_FOUND');
  if (requireActive && company.status !== 'active') {
    throw new AppError('This company is not active.', 403, 'COMPANY_INACTIVE');
  }
  return company;
}

async function onboardingAfterSiteChange(userId, client) {
  const user = await userModel.findById(userId, client);
  const siteCount = user.company_id ? await siteModel.countByCompany(user.company_id, client) : 0;
  return deriveOnboardingStatus(user, siteCount);
}

async function createSite(user, companyId, input, req) {
  await assertCompanyAccess(user, companyId, { requireActive: true });
  return withTransaction(async (client) => {
    const count = await siteModel.countByCompany(companyId, client);
    const isPrimary = count === 0 ? true : Boolean(input.isPrimary);
    if (isPrimary) {
      await siteModel.clearPrimary(companyId, null, client);
    }
    const site = await siteModel.create({
      companyId,
      siteName: input.siteName,
      address: input.address || input.fullAddress,
      city: input.city,
      state: input.state,
      country: input.country,
      pincode: input.pincode,
      latitude: input.latitude,
      longitude: input.longitude,
      siteType: normalizeSiteType(input.siteType),
      isPrimary,
      status: input.status || 'active',
    }, client);
    const onboardingStatus = await onboardingAfterSiteChange(user.id, client);
    await auditService.createAuditLog({
      userId: user.id,
      companyId,
      siteId: site.id,
      action: 'site.created',
      entityType: 'site',
      entityId: site.id,
      description: 'Site created',
      req,
      client,
    });
    return {
      site: toPublicSite(site),
      onboardingStatus: onboardingStatus === ONBOARDING.PROFILE_PENDING
        || onboardingStatus === ONBOARDING.ONBOARDING_COMPLETED
        ? onboardingStatus
        : ONBOARDING.SITES_COMPLETED,
    };
  });
}

async function listSites(user, companyId) {
  await assertCompanyAccess(user, companyId);
  const sites = await siteModel.listByCompany(companyId);
  return { sites: sites.map(toPublicSite) };
}

async function getSite(user, siteId) {
  const site = await siteModel.findById(siteId);
  if (!site) throw new AppError('Site not found.', 404, 'NOT_FOUND');
  await assertCompanyAccess(user, site.company_id);
  return { site: toPublicSite(site) };
}

async function updateSite(user, siteId, input, req) {
  const existing = await siteModel.findById(siteId);
  if (!existing) throw new AppError('Site not found.', 404, 'NOT_FOUND');
  await assertCompanyAccess(user, existing.company_id, { requireActive: true });
  return withTransaction(async (client) => {
    if (input.isPrimary === false && existing.is_primary) {
      throw new AppError('Assign another primary site first.', 409, 'PRIMARY_SITE_REQUIRED');
    }
    if (input.isPrimary === true) {
      await siteModel.clearPrimary(existing.company_id, siteId, client);
    }
    const site = await siteModel.update(siteId, {
      siteName: input.siteName,
      address: input.address || input.fullAddress,
      city: input.city,
      state: input.state,
      country: input.country,
      pincode: input.pincode,
      latitude: input.latitude,
      longitude: input.longitude,
      siteType: input.siteType ? normalizeSiteType(input.siteType) : undefined,
      isPrimary: input.isPrimary,
      status: input.status,
    }, client);
    await auditService.createAuditLog({
      userId: user.id,
      companyId: site.company_id,
      siteId: site.id,
      action: 'site.updated',
      entityType: 'site',
      entityId: site.id,
      description: 'Site updated',
      req,
      client,
    });
    return { site: toPublicSite(site) };
  });
}

async function setSiteStatus(user, siteId, status, req) {
  const existing = await siteModel.findById(siteId);
  if (!existing) throw new AppError('Site not found.', 404, 'NOT_FOUND');
  await assertCompanyAccess(user, existing.company_id, { requireActive: true });
  return withTransaction(async (client) => {
    let isPrimary = existing.is_primary;
    if (status !== 'active' && existing.is_primary) {
      const others = await siteModel.listByCompany(existing.company_id, client);
      const next = others.find((site) => site.id !== siteId && site.status === 'active');
      if (!next) {
        throw new AppError('Add another site before deactivating the primary site.', 409, 'PRIMARY_SITE_REQUIRED');
      }
      await siteModel.clearPrimary(existing.company_id, next.id, client);
      await siteModel.update(next.id, { isPrimary: true }, client);
      isPrimary = false;
    }
    const site = await siteModel.update(siteId, { status, isPrimary }, client);
    await auditService.createAuditLog({
      userId: user.id,
      companyId: site.company_id,
      siteId: site.id,
      action: 'site.status_changed',
      entityType: 'site',
      entityId: site.id,
      description: 'Site status changed',
      req,
      metadata: { status },
      client,
    });
    return { site: toPublicSite(site) };
  });
}

async function setPrimarySite(user, siteId, req) {
  const existing = await siteModel.findById(siteId);
  if (!existing) throw new AppError('Site not found.', 404, 'NOT_FOUND');
  if (existing.status !== 'active') {
    throw new AppError('Activate the site before making it primary.', 409, 'SITE_INACTIVE');
  }
  return updateSite(user, siteId, { isPrimary: true }, req);
}

async function deleteSite(user, siteId, req) {
  const existing = await siteModel.findById(siteId);
  if (!existing) throw new AppError('Site not found.', 404, 'NOT_FOUND');
  await assertCompanyAccess(user, existing.company_id, { requireActive: true });
  return withTransaction(async (client) => {
    const count = await siteModel.countByCompany(existing.company_id, client);
    if (count <= 1 && existing.is_primary) {
      throw new AppError('Add another site before deleting the primary site.', 409, 'PRIMARY_SITE_REQUIRED');
    }
    const removed = await siteModel.remove(siteId, client);
    if (existing.is_primary) {
      const remaining = await siteModel.listByCompany(existing.company_id, client);
      const next = remaining.find((site) => site.status === 'active');
      if (next) {
        await siteModel.clearPrimary(existing.company_id, next.id, client);
        await siteModel.update(next.id, { isPrimary: true }, client);
      }
    }
    await auditService.createAuditLog({
      userId: user.id,
      companyId: existing.company_id,
      siteId: removed.id,
      action: 'site.deleted',
      entityType: 'site',
      entityId: removed.id,
      description: 'Site deleted',
      req,
      client,
    });
    return { message: 'Site deleted.' };
  });
}

module.exports = {
  toPublicSite,
  createSite,
  listSites,
  getSite,
  updateSite,
  setSiteStatus,
  setPrimarySite,
  deleteSite,
};
