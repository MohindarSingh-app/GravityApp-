const AppError = require('../../utils/energy_service/AppError');
const { toPublicUser } = require('../../utils/energy_service/publicUser');
const { withTransaction } = require('../../utils/energy_service/transaction');
const userModel = require('../../models/energy_service/user.model');
const roleModel = require('../../models/energy_service/role.model');
const sessionModel = require('../../models/energy_service/session.model');
const passwordService = require('./password.service');
const rbacService = require('./rbac.service');
const auditService = require('./audit.service');

async function assertSameCompany(actor, user) {
  if (!user || !rbacService.canAccessCompany(actor, user.company_id)) {
    throw new AppError('User not found.', 404, 'NOT_FOUND');
  }
}

async function listUsers(actor) {
  if (!actor.company_id) {
    throw new AppError('You do not have access to this company.', 403, 'FORBIDDEN');
  }
  const rows = await userModel.listByCompany(actor.company_id);
  return { users: rows.map((row) => toPublicUser(row)) };
}

async function getUser(actor, userId) {
  const user = await userModel.findById(userId);
  await assertSameCompany(actor, user);
  return { user: toPublicUser(user) };
}

async function createUser(actor, input, req) {
  if (!actor.company_id) {
    throw new AppError('Create a company before adding users.', 409, 'COMPANY_REQUIRED');
  }
  const role = await roleModel.findById(input.roleId);
  if (!role || role.status !== 'active') {
    throw new AppError('The selected role is not available.', 422, 'INVALID_ROLE');
  }
  if (!rbacService.canAssignRole(actor.role, role.name)) {
    throw new AppError('You cannot assign that role.', 403, 'FORBIDDEN');
  }
  if (input.email) {
    passwordService.assertNotSimilarToEmail(input.password, input.email);
    const existing = await userModel.findByEmail(input.email);
    if (existing) {
      throw new AppError('An account with this email already exists.', 409, 'EMAIL_IN_USE');
    }
  }
  if (input.phone) {
    const existingPhone = await userModel.findByPhone(input.phone);
    if (existingPhone) {
      throw new AppError('An account with this phone number already exists.', 409, 'PHONE_IN_USE');
    }
  }

  const passwordHash = await passwordService.hashPassword(input.password);
  try {
    const user = await userModel.create({
      email: input.email,
      phone: input.phone,
      name: input.name,
      passwordHash,
      roleId: role.id,
      companyId: actor.company_id,
      status: 'active',
    });
    await auditService.createAuditLog({
      userId: actor.id,
      companyId: actor.company_id,
      action: 'user.created',
      entityType: 'user',
      entityId: user.id,
      description: 'User created',
      req,
    });
    return { user: toPublicUser(user) };
  } catch (err) {
    if (err.code === '23505') {
      throw new AppError('An account with this email or phone already exists.', 409, 'ACCOUNT_IN_USE');
    }
    throw err;
  }
}

async function updateUser(actor, userId, input, req) {
  const existing = await userModel.findById(userId);
  await assertSameCompany(actor, existing);
  if (input.email && input.email !== existing.email) {
    const taken = await userModel.findByEmail(input.email);
    if (taken && taken.id !== userId) {
      throw new AppError('An account with this email already exists.', 409, 'EMAIL_IN_USE');
    }
  }
  if (input.phone && input.phone !== existing.phone) {
    const taken = await userModel.findByPhone(input.phone);
    if (taken && taken.id !== userId) {
      throw new AppError('An account with this phone number already exists.', 409, 'PHONE_IN_USE');
    }
  }
  const user = await userModel.updateProfile(userId, {
    name: input.name,
    email: input.email,
    phone: input.phone,
  });
  await auditService.createAuditLog({
    userId: actor.id,
    companyId: actor.company_id,
    action: 'user.updated',
    entityType: 'user',
    entityId: userId,
    description: 'User updated',
    req,
  });
  return { user: toPublicUser(user) };
}

async function setUserStatus(actor, userId, status, req) {
  if (actor.id === userId) {
    throw new AppError('You cannot change your own status.', 409, 'SELF_STATUS');
  }
  const existing = await userModel.findById(userId);
  await assertSameCompany(actor, existing);
  const user = await userModel.setStatus(userId, status);
  if (status !== 'active') {
    await sessionModel.revokeAllForUser(userId);
  }
  await auditService.createAuditLog({
    userId: actor.id,
    companyId: actor.company_id,
    action: status === 'active' ? 'user.activated' : 'user.deactivated',
    entityType: 'user',
    entityId: userId,
    description: status === 'active' ? 'User activated' : 'User deactivated',
    req,
    metadata: { status },
  });
  return { user: toPublicUser(user) };
}

async function setUserRole(actor, userId, roleId, req) {
  if (actor.id === userId) {
    throw new AppError('You cannot change your own role.', 409, 'SELF_ROLE');
  }
  const existing = await userModel.findById(userId);
  await assertSameCompany(actor, existing);
  const role = await roleModel.findById(roleId);
  if (!role || role.status !== 'active') {
    throw new AppError('The selected role is not available.', 422, 'INVALID_ROLE');
  }
  if (!rbacService.canAssignRole(actor.role, role.name)) {
    throw new AppError('You cannot assign that role.', 403, 'FORBIDDEN');
  }
  const user = await withTransaction(async (client) => {
    const updated = await userModel.setRole(userId, role.id, client);
    await sessionModel.revokeAllForUser(userId, client);
    return updated;
  });
  await auditService.createAuditLog({
    userId: actor.id,
    companyId: actor.company_id,
    action: 'user.role_changed',
    entityType: 'user',
    entityId: userId,
    description: 'User role changed',
    req,
    metadata: { role: role.name },
  });
  return { user: toPublicUser(user) };
}

module.exports = {
  listUsers,
  getUser,
  createUser,
  updateUser,
  setUserStatus,
  setUserRole,
};
