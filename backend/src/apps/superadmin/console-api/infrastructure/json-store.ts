import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import {
  createDefaultPermissionMatrix,
  isRole,
  PAGES,
  ROLES,
  validateRolePermissions,
  type PermissionMatrix,
  type Role,
} from '../domain/permissions.js';
import type { AuditEvent, PersistentState, StoredUser } from '../domain/models.js';

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}

function isPersistentState(value: unknown): value is PersistentState {
  if (!value || typeof value !== 'object') return false;
  const state = value as Partial<PersistentState>;
  return (
    state.version === 1 &&
    Array.isArray(state.users) &&
    !!state.permissions &&
    ROLES.every((role) => validateRolePermissions(state.permissions?.[role])) &&
    state.users.every((user) =>
      !!user &&
      typeof user.id === 'string' &&
      typeof user.name === 'string' &&
      typeof user.email === 'string' &&
      isRole(user.role) &&
      typeof user.disabled === 'boolean' &&
      typeof user.passwordSalt === 'string' &&
      typeof user.passwordHash === 'string' &&
      typeof user.createdAt === 'string' &&
      typeof user.updatedAt === 'string' &&
      (!('permissions' in user) || validateRolePermissions(user.permissions)),
    ) &&
    Array.isArray(state.auditEvents) &&
    state.auditEvents.every((event) =>
      !!event &&
      typeof event.id === 'string' &&
      typeof event.at === 'string' &&
      (typeof event.actorId === 'string' || event.actorId === null) &&
      (typeof event.actorEmail === 'string' || event.actorEmail === null) &&
      typeof event.action === 'string' &&
      typeof event.targetType === 'string' &&
      typeof event.targetId === 'string' &&
      !!event.details &&
      typeof event.details === 'object' &&
      !Array.isArray(event.details),
    )
  );
}

export class JsonStore {
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(private readonly filePath: string) {}

  async initialize(bootstrap: {
    email: string;
    name: string;
    passwordSalt: string;
    passwordHash: string;
  }): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });

    try {
      await this.readState();
      return;
    } catch (error) {
      if (!isNodeError(error) || error.code !== 'ENOENT') throw error;
    }

    if (!bootstrap.email || !bootstrap.passwordSalt || !bootstrap.passwordHash) {
      throw new Error('Set SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD before first startup.');
    }

    const now = new Date().toISOString();
    const state: PersistentState = {
      version: 1,
      users: [
        {
          id: randomUUID(),
          name: bootstrap.name,
          email: bootstrap.email.trim().toLowerCase(),
          role: 'superadmin',
          disabled: false,
          passwordSalt: bootstrap.passwordSalt,
          passwordHash: bootstrap.passwordHash,
          createdAt: now,
          updatedAt: now,
        },
      ],
      permissions: createDefaultPermissionMatrix(),
      auditEvents: [
        {
          id: randomUUID(),
          at: now,
          actorId: null,
          actorEmail: null,
          action: 'system.bootstrap',
          targetType: 'user',
          targetId: 'superadmin',
          details: { email: bootstrap.email.trim().toLowerCase() },
        },
      ],
    };
    await this.writeState(state);
  }

  async listUsers(): Promise<StoredUser[]> {
    return (await this.readState()).users;
  }

  async getUserById(id: string): Promise<StoredUser | undefined> {
    return (await this.readState()).users.find((user) => user.id === id);
  }

  async getUserByEmail(email: string): Promise<StoredUser | undefined> {
    const normalizedEmail = email.trim().toLowerCase();
    return (await this.readState()).users.find((user) => user.email === normalizedEmail);
  }

  async getPermissions(): Promise<PermissionMatrix> {
    return (await this.readState()).permissions;
  }

  async listAuditEvents(): Promise<AuditEvent[]> {
    return (await this.readState()).auditEvents.slice().reverse();
  }

  async addUser(user: StoredUser, actor: StoredUser): Promise<void> {
    await this.mutate((state) => {
      if (state.users.some((existing) => existing.email === user.email)) {
        throw new StoreConflictError('An account with this email already exists.');
      }
      state.users.push(user);
      state.auditEvents.push(this.audit(actor, 'user.created', 'user', user.id, {
        email: user.email,
        role: user.role,
      }));
    });
  }

  async ensureLocalDemoSuperadmin(user: {
    name: string;
    email: string;
    passwordSalt: string;
    passwordHash: string;
  }): Promise<void> {
    const email = user.email.trim().toLowerCase();
    await this.mutate((state) => {
      const existing = state.users.find((candidate) => candidate.email === email);
      const previousDemo = email === 'demo-admin@localhost.test'
        ? undefined
        : state.users.find((candidate) =>
            candidate.email === 'demo-admin@localhost.test' &&
            candidate.name === 'Local Demo Superadmin' &&
            candidate.role === 'superadmin',
          );
      const now = new Date().toISOString();
      if (existing) {
        if (existing.role !== 'superadmin') {
          throw new StoreConflictError('The local demo account email is already assigned to a non-superadmin user.');
        }
        if (previousDemo && previousDemo.id !== existing.id) {
          state.users = state.users.filter((candidate) => candidate.id !== previousDemo.id);
        }
        existing.name = user.name;
        existing.disabled = false;
        existing.passwordSalt = user.passwordSalt;
        existing.passwordHash = user.passwordHash;
        existing.updatedAt = now;
        state.auditEvents.push(this.audit(null, 'system.local_demo_rotated', 'user', existing.id, { email }));
        return;
      }

      if (previousDemo) {
        previousDemo.name = user.name;
        previousDemo.email = email;
        previousDemo.disabled = false;
        previousDemo.passwordSalt = user.passwordSalt;
        previousDemo.passwordHash = user.passwordHash;
        previousDemo.updatedAt = now;
        state.auditEvents.push(this.audit(null, 'system.local_demo_rotated', 'user', previousDemo.id, { email }));
        return;
      }

      const demoUser: StoredUser = {
        id: randomUUID(),
        name: user.name,
        email,
        role: 'superadmin',
        disabled: false,
        passwordSalt: user.passwordSalt,
        passwordHash: user.passwordHash,
        createdAt: now,
        updatedAt: now,
      };
      state.users.push(demoUser);
      state.auditEvents.push(this.audit(null, 'system.local_demo_created', 'user', demoUser.id, { email }));
    });
  }

  async updateUser(
    id: string,
    changes: Pick<StoredUser, 'role' | 'disabled'>,
    actor: StoredUser,
  ): Promise<StoredUser | undefined> {
    return this.mutate((state) => {
      const user = state.users.find((candidate) => candidate.id === id);
      if (!user) return undefined;
      const previous = { role: user.role, disabled: user.disabled };
      user.role = changes.role;
      user.disabled = changes.disabled;
      user.updatedAt = new Date().toISOString();
      state.auditEvents.push(this.audit(actor, 'user.updated', 'user', user.id, {
        previousRole: previous.role,
        role: changes.role,
        previousDisabled: previous.disabled,
        disabled: changes.disabled,
      }));
      return user;
    });
  }

  async updateUserPermissions(
    id: string,
    permissions: StoredUser['permissions'] | null,
    actor: StoredUser,
  ): Promise<StoredUser | undefined> {
    return this.mutate((state) => {
      const user = state.users.find((candidate) => candidate.id === id);
      if (!user) return undefined;

      const previous = user.permissions ?? state.permissions[user.role];
      const updated = permissions ?? state.permissions[user.role];
      const changed: Record<string, string | boolean | number | null> = {};
      for (const { key } of PAGES) {
        for (const action of ['view', 'create', 'edit', 'delete'] as const) {
          if (previous[key][action] !== updated[key][action]) {
            changed[`${key}.${action}`] = updated[key][action];
          }
        }
      }

      if (permissions) user.permissions = permissions;
      else delete user.permissions;
      user.updatedAt = new Date().toISOString();
      state.auditEvents.push(this.audit(actor, 'user.permissions_updated', 'user', user.id, {
        email: user.email,
        mode: permissions ? 'custom' : 'role_default',
        ...changed,
      }));
      return user;
    });
  }

  async updateRolePermissions(
    role: Role,
    permissions: PermissionMatrix[Role],
    actor: StoredUser,
  ): Promise<void> {
    await this.mutate((state) => {
      const previous = state.permissions[role];
      const changes: Record<string, string | boolean | number | null> = {};
      for (const { key } of PAGES) {
        for (const action of ['view', 'create', 'edit', 'delete'] as const) {
          if (previous[key][action] !== permissions[key][action]) {
            changes[`${key}.${action}`] = permissions[key][action];
          }
        }
      }
      state.permissions[role] = permissions;
      state.auditEvents.push(this.audit(actor, 'permissions.updated', 'role', role, changes));
    });
  }

  async recordAudit(
    actor: StoredUser | null,
    action: string,
    targetType: string,
    targetId: string,
    details: AuditEvent['details'] = {},
  ): Promise<void> {
    await this.mutate((state) => {
      state.auditEvents.push(this.audit(actor, action, targetType, targetId, details));
    });
  }

  private audit(
    actor: StoredUser | null,
    action: string,
    targetType: string,
    targetId: string,
    details: AuditEvent['details'],
  ): AuditEvent {
    return {
      id: randomUUID(),
      at: new Date().toISOString(),
      actorId: actor?.id ?? null,
      actorEmail: actor?.email ?? null,
      action,
      targetType,
      targetId,
      details,
    };
  }

  private async mutate<T>(change: (state: PersistentState) => T): Promise<T> {
    const operation = this.writeQueue.then(async () => {
      const state = await this.readState();
      const result = change(state);
      await this.writeState(state);
      return result;
    });
    this.writeQueue = operation.then(() => undefined, () => undefined);
    return operation;
  }

  private async readState(): Promise<PersistentState> {
    const contents = await readFile(this.filePath, 'utf8');
    let parsed: unknown;
    try {
      parsed = JSON.parse(contents);
    } catch (error) {
      throw new Error(`The access-control file contains invalid JSON: ${String(error)}`);
    }
    if (!isPersistentState(parsed)) {
      throw new Error('The access-control file has an unsupported or invalid structure.');
    }
    return parsed;
  }

  private async writeState(state: PersistentState): Promise<void> {
    const tempPath = `${this.filePath}.${randomUUID()}.tmp`;
    await writeFile(tempPath, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
    await rename(tempPath, this.filePath);
  }
}

export class StoreConflictError extends Error {}

