const AppError = require('../../utils/energy_service/AppError');
const roleModel = require('../../models/energy_service/role.model');
const auditService = require('./audit.service');

function toPublicRole(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function listRoles() {
  const rows = await roleModel.list();
  return { roles: rows.map(toPublicRole) };
}

async function getRole(id) {
  const role = await roleModel.findById(id);
  if (!role) throw new AppError('Role not found.', 404, 'NOT_FOUND');
  return { role: toPublicRole(role) };
}

async function updateRole(actor, id, input, req) {
  const existing = await roleModel.findById(id);
  if (!existing) throw new AppError('Role not found.', 404, 'NOT_FOUND');
  if (input.status === 'inactive' && existing.name === actor.role) {
    throw new AppError('You cannot deactivate your own role.', 409, 'SELF_ROLE');
  }
  const role = await roleModel.update(id, {
    description: input.description,
    status: input.status,
  });
  await auditService.createAuditLog({
    userId: actor.id,
    companyId: actor.company_id,
    action: input.status ? 'role.status_changed' : 'role.updated',
    entityType: 'role',
    entityId: role.id,
    description: input.status ? 'Role status changed' : 'Role updated',
    req,
    metadata: input.status ? { status: input.status } : undefined,
  });
  return { role: toPublicRole(role) };
}

module.exports = {
  listRoles,
  getRole,
  updateRole,
};
