export type Role = 'superadmin' | 'admin' | 'viewer';
export type PermissionAction = 'view' | 'create' | 'edit' | 'delete';

export const PAGE_KEYS = [
  'dashboard',
  'analytics',
  'livemonitor',
  'jobs',
  'repair',
  'projects',
  'inventory',
  'verification',
  'disputes',
  'directory',
  'companies',
  'amc',
  'finance',
  'invoices',
  'customer-panel',
  'partner-app',
  'users',
  'activity',
  'settings',
] as const;

export type PageKey = (typeof PAGE_KEYS)[number];
export type PagePermissions = Record<PermissionAction, boolean>;
export type RolePermissions = Record<PageKey, PagePermissions>;
export type PermissionMatrix = Record<Role, RolePermissions>;

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatarInitials: string;
  permissions: RolePermissions;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  disabled: boolean;
  customAccess: boolean;
  createdAt: string;
}

export interface AuditEntry {
  id: string;
  at: string;
  actorId: string | null;
  actorEmail: string | null;
  action: string;
  targetType: string;
  targetId: string;
  details: Record<string, string | boolean | number | null>;
}
