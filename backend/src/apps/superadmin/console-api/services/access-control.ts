import { randomUUID } from 'node:crypto';
import {
  hasPermission,
  ACTIONS,
  PAGES,
  type PageKey,
  type PermissionAction,
  type PermissionMatrix,
  type Role,
  type RolePermissions,
} from '../domain/permissions.js';
import type { SessionUser, StoredUser } from '../domain/models.js';
import { JsonStore, StoreConflictError } from '../infrastructure/json-store.js';
import { hashPassword } from './passwords.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class AccessControlService {
  constructor(private readonly store: JsonStore) {}

  async sessionUser(user: StoredUser): Promise<SessionUser> {
    const matrix = await this.store.getPermissions();
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatarInitials: user.name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0] ?? '')
        .join('')
        .toUpperCase(),
      permissions: user.role === 'superadmin'
        ? matrix.superadmin
        : user.permissions ?? matrix[user.role],
    };
  }

  async can(user: StoredUser, page: PageKey, action: PermissionAction): Promise<boolean> {
    const matrix = await this.store.getPermissions();
    if (user.role === 'superadmin') return hasPermission(user.role, matrix, page, action);
    return (user.permissions ?? matrix[user.role])[page][action];
  }

  async recordDenied(user: StoredUser, page: PageKey, action: PermissionAction): Promise<void> {
    await this.store.recordAudit(user, 'auth.permission_denied', 'page', page, { action });
  }

  async createUser(
    input: { name: string; email: string; password: string; role: Role },
    actor: StoredUser,
  ): Promise<StoredUser> {
    const name = input.name.trim();
    const email = input.email.trim().toLowerCase();
    if (name.length < 2 || name.length > 100) {
      throw new InputError('Name must be between 2 and 100 characters.');
    }
    if (!EMAIL_PATTERN.test(email) || email.length > 254) {
      throw new InputError('Enter a valid email address.');
    }
    if (input.password.length < 12 || input.password.length > 200) {
      throw new InputError('Password must be between 12 and 200 characters.');
    }
    if (input.role === 'superadmin' && actor.role !== 'superadmin') {
      throw new InputError('Only a superadmin can create another superadmin.');
    }
    if (actor.role !== 'superadmin') {
      const matrix = await this.store.getPermissions();
      this.assertWithinActorPermissions(matrix[input.role], actor, matrix);
    }

    const credentials = hashPassword(input.password);
    const now = new Date().toISOString();
    const user: StoredUser = {
      id: randomUUID(),
      name,
      email,
      role: input.role,
      disabled: false,
      passwordSalt: credentials.salt,
      passwordHash: credentials.hash,
      createdAt: now,
      updatedAt: now,
    };
    await this.store.addUser(user, actor);
    return user;
  }

  async updateUser(
    id: string,
    input: { role: Role; disabled: boolean },
    actor: StoredUser,
  ): Promise<StoredUser> {
    const existing = await this.store.getUserById(id);
    if (!existing) throw new NotFoundError('User not found.');
    if (existing.role === 'superadmin') {
      throw new InputError('Superadmin accounts cannot be changed here.');
    }
    if (existing.id === actor.id && input.role !== existing.role) {
      throw new InputError('You cannot change your own role.');
    }
    if (existing.id === actor.id && input.disabled) {
      throw new InputError('You cannot disable your own account.');
    }
    if (input.role === 'superadmin' && actor.role !== 'superadmin') {
      throw new InputError('Only a superadmin can assign the superadmin role.');
    }
    if (actor.role !== 'superadmin' && input.role !== existing.role) {
      const matrix = await this.store.getPermissions();
      const targetPermissions = existing.permissions ?? matrix[input.role];
      this.assertWithinActorPermissions(targetPermissions, actor, matrix);
    }

    const updated = await this.store.updateUser(id, input, actor);
    if (!updated) throw new NotFoundError('User not found.');
    return updated;
  }

  async updatePermissions(
    role: Role,
    permissions: PermissionMatrix[Role],
    actor: StoredUser,
  ): Promise<void> {
    if (role === 'superadmin') {
      throw new InputError('Superadmin permissions are fixed and cannot be changed.');
    }
    await this.store.updateRolePermissions(role, permissions, actor);
  }

  async updateUserPermissions(
    id: string,
    permissions: RolePermissions | null,
    actor: StoredUser,
  ): Promise<StoredUser> {
    const user = await this.store.getUserById(id);
    if (!user) throw new NotFoundError('User not found.');
    if (user.role === 'superadmin') {
      throw new InputError('Superadmin access is fixed and cannot be changed.');
    }

    const updated = await this.store.updateUserPermissions(id, permissions, actor);
    if (!updated) throw new NotFoundError('User not found.');
    return updated;
  }

  private assertWithinActorPermissions(
    target: RolePermissions,
    actor: StoredUser,
    matrix: PermissionMatrix,
  ): void {
    const actorPermissions = actor.permissions ?? matrix[actor.role];
    for (const { key } of PAGES) {
      for (const action of ACTIONS) {
        if (target[key][action] && !actorPermissions[key][action]) {
          throw new InputError('You cannot grant access beyond your own permissions.');
        }
      }
    }
  }
}

export class InputError extends Error {}
export class NotFoundError extends Error {}
export { StoreConflictError };
