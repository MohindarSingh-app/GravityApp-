const { ACCESS, roleAllows } = require('../../constants/energy_service/roles');

function can(role, action) {
  return roleAllows(role, action);
}

function canAccessCompany(user, companyId) {
  if (!user || !companyId) return false;
  // A platform maintenance head is not attached to a company. Company members stay inside their own company.
  if (user.role === 'MAINTENANCE_HEAD' && !user.company_id) return true;
  return user.company_id === companyId
    || Boolean(user.company_ids && user.company_ids.includes(companyId));
}

function canAssignRole(actorRole, targetRole) {
  if (actorRole === 'DIRECTOR_OWNER') return true;
  if (actorRole === 'MAINTENANCE_HEAD') return targetRole !== 'DIRECTOR_OWNER';
  return false;
}

function canSelfAssignRole(currentRole, targetRole) {
  if (currentRole === targetRole) return true;
  const currentPermissions = new Set(
    Object.entries(ACCESS)
      .filter(([_action, roles]) => roles.includes(currentRole))
      .map(([action]) => action),
  );
  const targetPermissions = Object.entries(ACCESS)
    .filter(([_action, roles]) => roles.includes(targetRole))
    .map(([action]) => action);
  return targetPermissions.every((action) => currentPermissions.has(action));
}

module.exports = {
  can,
  canAccessCompany,
  canAssignRole,
  canSelfAssignRole,
};
