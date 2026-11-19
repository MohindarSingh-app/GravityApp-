const ROLES = {
  OWNER: 'DIRECTOR_OWNER',
  ADMIN: 'MAINTENANCE_HEAD',
  MANAGER: 'PURCHASE_MGR',
  USER: 'SITE_ENGINEER',
};

const ROLE_NAMES = [ROLES.OWNER, ROLES.ADMIN, ROLES.MANAGER, ROLES.USER];

const ALL_ROLES = ROLE_NAMES;

const ACCESS = {
  'companies.create': [ROLES.OWNER, ROLES.ADMIN, ROLES.USER],
  'companies.read': ALL_ROLES,
  'companies.update': [ROLES.OWNER, ROLES.ADMIN],
  'companies.status': [ROLES.OWNER, ROLES.ADMIN],
  'sites.create': [ROLES.OWNER, ROLES.ADMIN, ROLES.MANAGER],
  'sites.read': ALL_ROLES,
  'sites.update': [ROLES.OWNER, ROLES.ADMIN, ROLES.MANAGER],
  'sites.delete': [ROLES.OWNER, ROLES.ADMIN],
  'sites.status': [ROLES.OWNER, ROLES.ADMIN, ROLES.MANAGER],
  'profile.read': ALL_ROLES,
  'profile.update': ALL_ROLES,
  'notifications.read': ALL_ROLES,
  'sessions.read': ALL_ROLES,
  'sessions.revoke': ALL_ROLES,
  'api_keys.create': [ROLES.OWNER, ROLES.ADMIN],
  'api_keys.read': [ROLES.OWNER, ROLES.ADMIN],
  'api_keys.revoke': [ROLES.OWNER, ROLES.ADMIN],
  'api_keys.rotate': [ROLES.OWNER, ROLES.ADMIN],
  'users.read': [ROLES.OWNER, ROLES.ADMIN, ROLES.MANAGER],
  'users.manage': [ROLES.OWNER, ROLES.ADMIN],
  'roles.read': ALL_ROLES,
  'roles.manage': [ROLES.OWNER],
  'dashboard.read': ALL_ROLES,
  'jobs.read': ALL_ROLES,
  'jobs.create': ALL_ROLES,
  'jobs.update': [ROLES.OWNER, ROLES.ADMIN, ROLES.USER],
  'amc.read': ALL_ROLES,
  'amc.quote': [ROLES.OWNER, ROLES.ADMIN, ROLES.MANAGER],
  'signals.create': ALL_ROLES,
  'repairs.create': [ROLES.OWNER, ROLES.ADMIN, ROLES.MANAGER],
  'marketplace.read': [ROLES.OWNER, ROLES.ADMIN, ROLES.MANAGER],
  'marketplace.write': [ROLES.OWNER, ROLES.ADMIN, ROLES.MANAGER],
  'marketplace.manage': [ROLES.OWNER, ROLES.ADMIN],
  'certs.read': ALL_ROLES,
  'certs.manage': [ROLES.OWNER, ROLES.ADMIN],
  'customer.amc.read': ALL_ROLES,
  'customer.amc.write': ALL_ROLES,
  'customer.amc.manage': [ROLES.OWNER, ROLES.ADMIN],
  'customer.repairs.read': ALL_ROLES,
  'customer.repairs.write': ALL_ROLES,
  'customer.repairs.manage': [ROLES.OWNER, ROLES.ADMIN],
  'customer.projects.read': ALL_ROLES,
  'customer.projects.write': ALL_ROLES,
  'customer.projects.manage': [ROLES.OWNER, ROLES.ADMIN],
  'customer.services.read': ALL_ROLES,
  'customer.services.write': ALL_ROLES,
  'customer.services.manage': [ROLES.OWNER, ROLES.ADMIN],
};

function roleAllows(role, action) {
  const allowed = ACCESS[action];
  return Array.isArray(allowed) && allowed.includes(role);
}

module.exports = {
  ROLES,
  ROLE_NAMES,
  ACCESS,
  roleAllows,
};
