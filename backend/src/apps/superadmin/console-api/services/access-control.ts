import { randomUUID } from 'node:crypto';
import {
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
    if (!user.userCode) throw new Error('The user reference code is unavailable.');
    return {
      id: user.id,
      userCode: user.userCode,
      name: user.name,
      email: user.email,
      phone: user.phone ?? null,
      role: user.role,
      profileSetupRequired: user.role === 'admin' && !user.profileCompletedAt,
      avatarUrl: await this.store.hasAvatar(user.id)
        ? `/api/superadmin/console/auth/profile/avatar?v=${encodeURIComponent(user.updatedAt)}`
        : null,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      accessMode: user.permissions ? 'custom' : 'role',
      permissionsAssignedBy: user.permissions && user.permissionsAssignedBy
        ? { name: user.permissionsAssignedBy.name, email: user.permissionsAssignedBy.email }
        : null,
      avatarInitials: user.name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0] ?? '')
        .join('')
        .toUpperCase(),
      permissions: user.permissions ?? matrix[user.role],
    };
  }

  async can(user: StoredUser, page: PageKey, action: PermissionAction): Promise<boolean> {
    const matrix = await this.store.getPermissions();
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
    const matrix = await this.store.getPermissions();
    this.assertWithinActorPermissions(matrix[input.role], actor, matrix);

    const credentials = hashPassword(input.password);
    const now = new Date().toISOString();
    const user: StoredUser = {
      id: randomUUID(),
      name,
      email,
      phone: null,
      profileCompletedAt: input.role === 'admin' ? null : now,
      role: input.role,
      disabled: false,
      passwordSalt: credentials.salt,
      passwordHash: credentials.hash,
      createdAt: now,
      updatedAt: now,
    };
    return this.store.addUser(user, actor);
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
    if (input.role !== existing.role) {
      const matrix = await this.store.getPermissions();
      const targetPermissions = existing.permissions ?? matrix[input.role];
      this.assertWithinActorPermissions(targetPermissions, actor, matrix);
    }

    const updated = await this.store.updateUser(id, input, actor);
    if (!updated) throw new NotFoundError('User not found.');
    return updated;
  }

  async deleteUser(id: string, actor: StoredUser): Promise<void> {
    if (actor.role !== 'superadmin') {
      throw new InputError('Only a superadmin can delete user accounts.');
    }
    if (id === actor.id) {
      throw new InputError('You cannot delete your own account.');
    }
    const existing = await this.store.getUserById(id);
    if (!existing) throw new NotFoundError('User not found.');
    if (existing.role === 'superadmin') {
      throw new InputError('Superadmin accounts cannot be deleted here.');
    }
    if (!(await this.store.deleteUser(id, actor))) throw new NotFoundError('User not found.');
  }

  async updateProfile(
    user: StoredUser,
    input: { name: string; phone: string | null; completeSetup?: boolean },
  ): Promise<StoredUser> {
    const name = input.name.trim();
    if (name.length < 2 || name.length > 100) {
      throw new InputError('Name must be between 2 and 100 characters.');
    }
    const phone = input.phone?.trim() || null;
    if (phone && (phone.length < 6 || phone.length > 32 || !/^[+()\d.\-\s]+$/.test(phone))) {
      throw new InputError('Enter a valid phone number or leave it blank.');
    }
    if (input.completeSetup && (user.role !== 'admin' || !phone)) {
      throw new InputError('Admin profile setup requires a valid contact number.');
    }
    if (input.completeSetup && !(await this.store.hasAvatar(user.id))) {
      throw new InputError('Add a profile picture to complete admin profile setup.');
    }
    const updated = await this.store.updateProfile(
      user.id,
      { name, phone, completeSetup: input.completeSetup },
      user,
    );
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
    const matrix = await this.store.getPermissions();
    this.assertWithinActorPermissions(permissions, actor, matrix);
    await this.store.updateRolePermissions(role, permissions, actor);
  }

  async updateUserPermissions(
    id: string,
    permissions: RolePermissions | null,
    actor: StoredUser,
  ): Promise<StoredUser> {
    const user = await this.store.getUserById(id);
    if (!user) throw new NotFoundError('User not found.');
    if (user.id === actor.id) throw new InputError('You cannot change your own page access.');

    const matrix = await this.store.getPermissions();
    this.assertWithinActorPermissions(permissions ?? matrix[user.role], actor, matrix);

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
