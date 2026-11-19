const AppError = require('../../utils/energy_service/AppError');
const { isValidGstin, normalizeGstin } = require('../../utils/energy_service/gst');
const { withTransaction } = require('../../utils/energy_service/transaction');
const { deriveOnboardingStatus } = require('../../constants/energy_service/onboarding');
const { ROLES } = require('../../constants/energy_service/roles');
const companyModel = require('../../models/energy_service/company.model');
const userModel = require('../../models/energy_service/user.model');
const roleModel = require('../../models/energy_service/role.model');
const rbacService = require('./rbac.service');
const auditService = require('./audit.service');
const { toPublicUser } = require('../../utils/energy_service/publicUser');
const siteModel = require('../../models/energy_service/site.model');

function toPublicCompany(row) {
  return {
    id: row.id,
    companyName: row.company_name,
    legalName: row.legal_name,
    gst: row.gst_number,
    gstin: row.gst_number,
    gstNumber: row.gst_number,
    industry: row.industry,
    city: row.city,
    state: row.state,
    country: row.country,
    pincode: row.pincode,
    address: row.address,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function assertGstin(value) {
  const gstin = normalizeGstin(value);
  if (!isValidGstin(gstin)) {
    throw new AppError('Enter a valid GSTIN.', 422, 'INVALID_GSTIN');
  }
  return gstin;
}

function gstFromInput(input) {
  return input.gstNumber || input.gst || input.gstin;
}

async function createCompany(user, input, req) {
  const copyFromCompanyId = input.copyFromCompanyId || null;
  if (user.company_id && !copyFromCompanyId) {
    throw new AppError('This account already belongs to a company.', 409, 'COMPANY_EXISTS');
  }
  if (copyFromCompanyId && !rbacService.canAccessCompany(user, copyFromCompanyId)) {
    throw new AppError('You do not have access to the source company.', 403, 'FORBIDDEN');
  }
  if (copyFromCompanyId && copyFromCompanyId !== user.company_id) {
    throw new AppError('Copy details from your currently selected company.', 409, 'COMPANY_COPY_SOURCE');
  }
  if (copyFromCompanyId && user.role !== ROLES.OWNER) {
    throw new AppError('Only the company owner can register a separate company workspace.', 403, 'FORBIDDEN');
  }
  const gstNumber = assertGstin(gstFromInput(input));
  return withTransaction(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [gstNumber]);
    const existingGst = await companyModel.listByGstNumber(gstNumber, client);
    if (existingGst.length && !existingGst.some((company) => rbacService.canAccessCompany(user, company.id))) {
      throw new AppError('A company with this GSTIN already exists.', 409, 'GSTIN_IN_USE');
    }
    try {
      const company = await companyModel.create({
        companyName: input.companyName,
        legalName: input.legalName,
        gstNumber,
        industry: input.industry,
        city: input.city,
        state: input.state,
        country: input.country,
        pincode: input.pincode,
        address: input.address,
        status: 'active',
        ownerUserId: user.id,
      }, client);
      const owner = await roleModel.findByName(ROLES.OWNER, client);
      await userModel.setCompany(user.id, company.id, client);
      if (!user.company_id) await userModel.setRole(user.id, owner.id, client);
      const copiedSites = copyFromCompanyId
        ? await siteModel.copyByCompany(copyFromCompanyId, company.id, client)
        : 0;
      const updatedUser = await userModel.findById(user.id, client);
      const activeSiteCount = await siteModel.countByCompany(company.id, client);
      const onboardingStatus = deriveOnboardingStatus(updatedUser, activeSiteCount);
      await auditService.createAuditLog({
        userId: user.id,
        companyId: company.id,
        action: 'company.created',
        entityType: 'company',
        entityId: company.id,
        description: 'Company created',
        metadata: copyFromCompanyId ? { copiedFromCompanyId: copyFromCompanyId, copiedSites } : undefined,
        req,
        client,
      });
      return {
        company: toPublicCompany(company),
        copiedSites,
        onboardingStatus,
      };
    } catch (err) {
      if (err.code === '23505') {
        throw new AppError('A company with this GSTIN already exists.', 409, 'GSTIN_IN_USE');
      }
      throw err;
    }
  });
}

async function getCompany(user, companyId) {
  if (!rbacService.canAccessCompany(user, companyId)) {
    throw new AppError('You do not have access to this company.', 403, 'FORBIDDEN');
  }
  const company = await companyModel.findById(companyId);
  if (!company) throw new AppError('Company not found.', 404, 'NOT_FOUND');
  return { company: toPublicCompany(company) };
}

async function listUserCompanies(user) {
  const rows = await companyModel.listByUser(user.id);
  return {
    companies: rows.map((row) => ({
      ...toPublicCompany(row),
      isActive: row.id === user.company_id,
    })),
  };
}

async function selectCompany(user, companyId, req) {
  if (!rbacService.canAccessCompany(user, companyId)) {
    throw new AppError('You do not have access to this company.', 403, 'FORBIDDEN');
  }
  const company = await companyModel.findById(companyId);
  if (!company) throw new AppError('Company not found.', 404, 'NOT_FOUND');
  const selected = await userModel.setActiveCompany(user.id, companyId);
  if (!selected) throw new AppError('Company membership is not available.', 403, 'FORBIDDEN');
  await auditService.createAuditLog({
    userId: user.id,
    companyId,
    action: 'company.selected',
    entityType: 'company',
    entityId: companyId,
    description: 'Active company changed',
    req,
  });
  const siteCount = await siteModel.countByCompany(companyId);
  return {
    company: toPublicCompany(company),
    onboardingStatus: deriveOnboardingStatus(selected, siteCount),
  };
}

async function updateCompany(user, companyId, input, req) {
  if (!rbacService.canAccessCompany(user, companyId)) {
    throw new AppError('You do not have access to this company.', 403, 'FORBIDDEN');
  }
  const gstRaw = gstFromInput(input);
  const gstNumber = gstRaw ? assertGstin(gstRaw) : undefined;
  return withTransaction(async (client) => {
    if (gstNumber) {
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [gstNumber]);
      const existingGst = await companyModel.listByGstNumber(gstNumber, client);
      if (existingGst.some((company) => company.id !== companyId
        && !rbacService.canAccessCompany(user, company.id))) {
        throw new AppError('A company with this GSTIN already exists.', 409, 'GSTIN_IN_USE');
      }
    }
    const company = await companyModel.update(companyId, {
      companyName: input.companyName,
      legalName: input.legalName,
      gstNumber,
      industry: input.industry,
      city: input.city,
      state: input.state,
      country: input.country,
      pincode: input.pincode,
      address: input.address,
      status: input.status,
    }, client);
    if (!company) throw new AppError('Company not found.', 404, 'NOT_FOUND');
    await auditService.createAuditLog({
      userId: user.id,
      companyId: company.id,
      action: input.status ? 'company.status_changed' : 'company.updated',
      entityType: 'company',
      entityId: company.id,
      description: input.status ? 'Company status changed' : 'Company updated',
      req,
      metadata: input.status ? { status: input.status } : undefined,
      client,
    });
    return { company: toPublicCompany(company) };
  });
}

async function setCompanyStatus(user, companyId, status, req) {
  return updateCompany(user, companyId, { status }, req);
}

async function listCompanyUsers(user, companyId) {
  if (!rbacService.canAccessCompany(user, companyId)) {
    throw new AppError('You do not have access to this company.', 403, 'FORBIDDEN');
  }
  const rows = await userModel.listByCompany(companyId);
  return { users: rows.map((row) => toPublicUser(row)) };
}

module.exports = {
  toPublicCompany,
  createCompany,
  getCompany,
  listUserCompanies,
  selectCompany,
  updateCompany,
  setCompanyStatus,
  listCompanyUsers,
};
