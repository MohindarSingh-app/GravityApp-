export const ROLES = ['superadmin', 'admin', 'viewer'] as const;
export type Role = (typeof ROLES)[number];

export const ACTIONS = ['view', 'create', 'edit', 'delete'] as const;
export type PermissionAction = (typeof ACTIONS)[number];

export const PAGES = [
  { key: 'dashboard', label: 'Dashboard', group: 'Overview' },
  { key: 'analytics', label: 'Analytics', group: 'Overview' },
  { key: 'livemonitor', label: 'Live Monitor', group: 'Operations' },
  { key: 'jobs', label: 'Jobs', group: 'Operations' },
  { key: 'repair', label: 'Repair Center', group: 'Operations' },
  { key: 'projects', label: 'Projects', group: 'Operations' },
  { key: 'inventory', label: 'Inventory', group: 'Operations' },
  { key: 'verification', label: 'Verification', group: 'Field Partners' },
  { key: 'disputes', label: 'Disputes', group: 'Field Partners' },
  { key: 'directory', label: 'App Registrations', group: 'Field Partners' },
  { key: 'companies', label: 'Companies', group: 'Business' },
  { key: 'amc', label: 'AMC Contracts', group: 'Business' },
  { key: 'finance', label: 'Finance & Payouts', group: 'Business' },
  { key: 'invoices', label: 'Invoices', group: 'Business' },
  { key: 'customer-panel', label: 'Customer Panel', group: 'Apps & Admin' },
  { key: 'partner-app', label: 'Partner App', group: 'Apps & Admin' },
  { key: 'users', label: 'Users & Roles', group: 'Apps & Admin' },
  { key: 'activity', label: 'Activity Log', group: 'Apps & Admin' },
  { key: 'settings', label: 'Settings', group: 'Apps & Admin' },
] as const;

export type PageKey = (typeof PAGES)[number]['key'];
export type PagePermissions = Record<PermissionAction, boolean>;
export type RolePermissions = Record<PageKey, PagePermissions>;
export type PermissionMatrix = Record<Role, RolePermissions>;

const EMPTY_ACTIONS: PagePermissions = {
  view: false,
  create: false,
  edit: false,
  delete: false,
};

function buildRolePermissions(
  enabledPages: readonly PageKey[],
  allowedActions: readonly PermissionAction[],
): RolePermissions {
  return Object.fromEntries(
    PAGES.map(({ key }) => [
      key,
      enabledPages.includes(key)
        ? Object.fromEntries(ACTIONS.map((action) => [action, allowedActions.includes(action)]))
        : { ...EMPTY_ACTIONS },
    ]),
  ) as RolePermissions;
}

export function createDefaultPermissionMatrix(): PermissionMatrix {
  const allPages = PAGES.map(({ key }) => key);
  const allActions = [...ACTIONS];
  const adminPages = allPages.filter((key) => !['users', 'activity'].includes(key));
  const viewerPages = allPages.filter((key) =>
    !['users', 'activity', 'settings', 'directory'].includes(key),
  );

  return {
    superadmin: buildRolePermissions(allPages, allActions),
    admin: buildRolePermissions(adminPages, ['view', 'create', 'edit', 'delete']),
    viewer: buildRolePermissions(viewerPages, ['view']),
  };
}

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && ROLES.includes(value as Role);
}

export function isPageKey(value: unknown): value is PageKey {
  return typeof value === 'string' && PAGES.some((page) => page.key === value);
}

export function isPermissionAction(value: unknown): value is PermissionAction {
  return typeof value === 'string' && ACTIONS.includes(value as PermissionAction);
}

export function validateRolePermissions(value: unknown): value is RolePermissions {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const permissions = value as Record<string, unknown>;

  return Object.keys(permissions).length === PAGES.length && PAGES.every(({ key }) => {
    const page = permissions[key];
    if (!page || typeof page !== 'object' || Array.isArray(page)) return false;
    const actions = page as Record<string, unknown>;
    return Object.keys(actions).length === ACTIONS.length &&
      ACTIONS.every((action) => typeof actions[action] === 'boolean');
  });
}

export function hasPermission(
  role: Role,
  matrix: PermissionMatrix,
  page: PageKey,
  action: PermissionAction,
): boolean {
  return role === 'superadmin' || matrix[role][page][action];
}
