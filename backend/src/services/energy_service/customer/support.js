const AppError = require('../../../utils/energy_service/AppError');
const siteModel = require('../../../models/energy_service/site.model');
const userModel = require('../../../models/energy_service/user.model');
const attachmentModel = require('../../../models/energy_service/customer/attachment.model');
const historyModel = require('../../../models/energy_service/customer/history.model');
const customerModel = require('../../../models/energy_service/customer/customer.model');
const auditService = require('../audit.service');
const { can } = require('../rbac.service');

function companyIdOf(user) {
  if (!user || !user.company_id) {
    throw new AppError('Create a company before using the customer panel.', 409, 'COMPANY_REQUIRED');
  }
  return user.company_id;
}

function assertIdentity(user, body) {
  if (body.companyId && body.companyId !== user.company_id) {
    throw new AppError('You do not have access to this company.', 403, 'FORBIDDEN');
  }
}

async function ensureCustomer(user, client) {
  const companyId = companyIdOf(user);
  const existing = await customerModel.findByUserAndCompany(user.id, companyId, client);
  if (existing) {
    return existing;
  }
  return customerModel.insert({ userId: user.id, companyId }, client);
}

async function resolveCustomer(companyId, actor, requestedId, client) {
  const own = await ensureCustomer(actor, client);
  if (!requestedId || requestedId === actor.id || requestedId === own.id) return own;
  let customer = await customerModel.findById(requestedId, client);
  if (!customer) customer = await customerModel.findByUserAndCompany(requestedId, companyId, client);
  if (!customer || customer.company_id !== companyId) {
    throw new AppError('That customer is not an active member of this company.', 422, 'INVALID_CUSTOMER');
  }
  const member = await userModel.findById(customer.user_id, client);
  if (!member || member.status !== 'active' || member.company_id !== companyId) {
    throw new AppError('That customer is not an active member of this company.', 422, 'INVALID_CUSTOMER');
  }
  return customer;
}

function actorKind(user, manageAction) {
  return can(user.role, manageAction) ? 'manage' : 'customer';
}

function notFound(label) {
  throw new AppError(`${label} was not found.`, 404, 'NOT_FOUND');
}

function pageOf(query) {
  const page = query && query.page !== undefined ? query.page : 1;
  const limit = query && query.limit !== undefined ? query.limit : 20;
  if (!Number.isSafeInteger(page) || page < 1 || page > 10000
    || !Number.isSafeInteger(limit) || limit < 1 || limit > 50) {
    throw new AppError('Page and limit must be valid positive integers.', 422, 'VALIDATION_ERROR');
  }
  return { page, limit, offset: (page - 1) * limit };
}

function paged(result, page, limit, mapRow) {
  return {
    items: result.rows.map(mapRow),
    pagination: { page, limit, total: result.total },
  };
}

function todayInIndia(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);
}

function asDateString(value) {
  if (!value) return null;
  if (typeof value === 'string') return value.slice(0, 10);
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function assertNotPast(date, label) {
  if (date && date < todayInIndia()) {
    throw new AppError(`${label} cannot be in the past.`, 422, 'VALIDATION_ERROR', [{ path: label, message: 'Date is in the past.' }]);
  }
}

function assertDateOrder(start, end) {
  if (start && end && end < start) {
    throw new AppError('The end date must be on or after the start date.', 422, 'VALIDATION_ERROR');
  }
}

async function assertSite(companyId, siteId, client) {
  const site = await siteModel.findById(siteId, client);
  if (!site || site.company_id !== companyId || site.status !== 'active') {
    throw new AppError('That site is not on this company.', 422, 'INVALID_SITE');
  }
  return site;
}

async function assertMember(companyId, customerId, client) {
  const member = await userModel.findById(customerId, client);
  if (!member || member.company_id !== companyId || member.status !== 'active') {
    throw new AppError('That customer is not an active member of this company.', 422, 'INVALID_CUSTOMER');
  }
  return member;
}

async function linkAttachments(client, { companyId, entityType, entityId, attachmentIds, replace }) {
  const ids = [...new Set(attachmentIds || [])];
  if (replace) {
    await attachmentModel.releaseExcept(companyId, entityType, entityId, ids, client);
  }
  if (!ids.length) return;
  const rows = await attachmentModel.lockByIds(ids, companyId, client);
  if (rows.length !== ids.length) {
    throw new AppError('One or more attachments were not found.', 422, 'ATTACHMENT_NOT_FOUND');
  }
  for (const row of rows) {
    const sameRecord = row.entity_id === entityId && row.entity_type === entityType;
    if (row.entity_id && !sameRecord) {
      throw new AppError('An attachment is already used on another record.', 409, 'ATTACHMENT_IN_USE');
    }
  }
  await attachmentModel.assignEntity(ids, companyId, entityType, entityId, client);
}

async function recordStatus(client, { companyId, entityType, entityId, fromStatus, toStatus, user, note }) {
  return historyModel.insert({
    companyId,
    entityType,
    entityId,
    fromStatus: fromStatus || null,
    toStatus,
    actorId: user.id,
    actorRole: user.role,
    note: note || null,
  }, client);
}

function audit(req, user, action, entityType, entityId, siteId, description, client) {
  return auditService.createAuditLog({
    userId: user.id,
    companyId: user.company_id,
    siteId: siteId || null,
    action,
    entityType,
    entityId,
    description,
    req,
    client,
  });
}

function mapDbError(err) {
  if (err instanceof AppError || (err && err.isOperational)) throw err;
  if (err && err.code === '23505') {
    const constraint = String(err.constraint || '');
    if (constraint.includes('reschedule')) {
      throw new AppError('A reschedule is already pending for this visit.', 409, 'RESCHEDULE_PENDING');
    }
    if (constraint.includes('serial')) {
      throw new AppError('A device with this serial number is already registered.', 409, 'DUPLICATE_SERIAL');
    }
    if (constraint.includes('reference') || constraint.includes('key') || constraint.includes('storage')) {
      throw new AppError('That attachment reference is already registered.', 409, 'DUPLICATE_ATTACHMENT');
    }
    throw new AppError('This record already exists.', 409, 'CONFLICT');
  }
  if (err && err.code === '23514') {
    throw new AppError('The submitted record is missing required details.', 422, 'VALIDATION_ERROR');
  }
  throw err;
}

module.exports = {
  companyIdOf,
  assertIdentity,
  actorKind,
  notFound,
  pageOf,
  paged,
  todayInIndia,
  asDateString,
  assertNotPast,
  assertDateOrder,
  assertSite,
  assertMember,
  ensureCustomer,
  resolveCustomer,
  linkAttachments,
  recordStatus,
  audit,
  mapDbError,
};
