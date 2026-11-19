import type { PermissionMatrix, Role, RolePermissions } from './permissions.js';

export interface StoredUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  disabled: boolean;
  permissions?: RolePermissions;
  passwordSalt: string;
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
}

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatarInitials: string;
  permissions: RolePermissions;
}

export interface AuditEvent {
  id: string;
  at: string;
  actorId: string | null;
  actorEmail: string | null;
  action: string;
  targetType: string;
  targetId: string;
  details: Record<string, string | boolean | number | null>;
}

export interface PersistentState {
  version: 1;
  users: StoredUser[];
  permissions: PermissionMatrix;
  auditEvents: AuditEvent[];
}
