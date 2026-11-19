import { Router, type Response } from 'express5';
import {
  isRole,
  PAGES,
  ROLES,
  validateRolePermissions,
  type PermissionMatrix,
  type Role,
} from '../domain/permissions.js';
import type { AuditEvent, StoredUser } from '../domain/models.js';
import { JsonStore, StoreConflictError } from '../infrastructure/json-store.js';
import { AccessControlService, InputError, NotFoundError } from '../services/access-control.js';
import { AuthenticationService } from '../services/authentication.js';
import { SessionManager } from '../services/sessions.js';
import { readSessionCookie, requireAuth, requirePermission, requireSuperadmin } from './middleware.js';

interface ApiDependencies {
  store: JsonStore;
  access: AccessControlService;
  authentication: AuthenticationService;
  sessions: SessionManager;
  secureCookies: boolean;
  localDemoCredentials?: { email: string; password: string } | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function publicUser(user: StoredUser) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    disabled: user.disabled,
    customAccess: !!user.permissions,
    createdAt: user.createdAt,
  };
}

function parseUserInput(body: unknown): { name: string; email: string; password: string; role: Role } | null {
  if (!isRecord(body) || typeof body.name !== 'string' || typeof body.email !== 'string' ||
      typeof body.password !== 'string' || !isRole(body.role)) return null;
  return { name: body.name, email: body.email, password: body.password, role: body.role };
}

function parseUserUpdate(body: unknown): { role: Role; disabled: boolean } | null {
  if (!isRecord(body) || !isRole(body.role) || typeof body.disabled !== 'boolean') return null;
  return { role: body.role, disabled: body.disabled };
}

function sendServiceError(response: Response, error: unknown): void {
  if (error instanceof InputError) {
    response.status(400).json({ message: error.message });
  } else if (error instanceof NotFoundError) {
    response.status(404).json({ message: error.message });
  } else if (error instanceof StoreConflictError) {
    response.status(409).json({ message: error.message });
  } else {
    throw error;
  }
}

export function createApiRouter(dependencies: ApiDependencies): Router {
  const { store, access, authentication, sessions, secureCookies, localDemoCredentials } = dependencies;
  const router = Router();
  const authenticate = requireAuth(store, sessions);

  router.get('/auth/local-demo', (_request, response): void => {
    response.json(localDemoCredentials
      ? { enabled: true, credentials: localDemoCredentials }
      : { enabled: false });
  });

  router.post('/auth/login', async (request, response): Promise<void> => {
    const body = request.body as Record<string, unknown> | undefined;
    if (!body || typeof body.email !== 'string' || typeof body.password !== 'string') {
      response.status(400).json({ message: 'Email and password are required.' });
      return;
    }
    if (body.email.trim().length === 0 || body.email.length > 254 ||
        body.password.length === 0 || body.password.length > 200) {
      response.status(400).json({ message: 'Email or password is invalid.' });
      return;
    }

    const user = await authentication.authenticate(body.email, body.password, request.ip ?? 'unknown');
    if (!user) {
      response.status(401).json({ message: 'Invalid email or password.' });
      return;
    }

    const session = sessions.create(user.id);
    response.cookie('eh_session', session.id, {
      httpOnly: true,
      secure: secureCookies,
      sameSite: 'lax',
      path: '/',
      expires: new Date(session.expiresAt),
    });
    response.json({
      user: await access.sessionUser(user),
      expiresAt: session.expiresAt,
    });
  });

  router.get('/auth/me', async (request, response): Promise<void> => {
    const sessionId = readSessionCookie(request.headers.cookie);
    const session = sessionId ? sessions.get(sessionId) : undefined;
    const user = session ? await store.getUserById(session.userId) : undefined;
    if (!sessionId || !session || !user || user.disabled) {
      if (sessionId && session) sessions.revoke(sessionId);
      response.json({ user: null, expiresAt: null });
      return;
    }
    response.json({
      user: await access.sessionUser(user),
      expiresAt: session.expiresAt,
    });
  });

  router.post('/auth/logout', authenticate, async (request, response): Promise<void> => {
    const user = request.authUser!;
    const sessionId = readSessionCookie(request.headers.cookie);
    if (sessionId) sessions.revoke(sessionId);
    await authentication.recordLogout(user);
    response.clearCookie('eh_session', {
      httpOnly: true,
      secure: secureCookies,
      sameSite: 'lax',
      path: '/',
    });
    response.status(204).end();
  });

  router.get(
    '/access/roles',
    authenticate,
    requirePermission(access, 'users', 'view'),
    requireSuperadmin,
    async (_request, response): Promise<void> => {
      response.json({ roles: ROLES, pages: PAGES, permissions: await store.getPermissions() });
    },
  );

  router.put(
    '/access/roles/:role',
    authenticate,
    requirePermission(access, 'users', 'edit'),
    requireSuperadmin,
    async (request, response): Promise<void> => {
      const role = request.params['role'];
      const body = request.body as Record<string, unknown> | undefined;
      if (!isRole(role) || !body || !validateRolePermissions(body.permissions)) {
        response.status(400).json({ message: 'A complete role permission matrix is required.' });
        return;
      }

      try {
        await access.updatePermissions(
          role,
          body.permissions as PermissionMatrix[Role],
          request.authUser!,
        );
        response.json({ permissions: await store.getPermissions() });
      } catch (error) {
        sendServiceError(response, error);
      }
    },
  );

  router.get(
    '/admin/users',
    authenticate,
    requirePermission(access, 'users', 'view'),
    async (_request, response): Promise<void> => {
      response.json({ users: (await store.listUsers()).map(publicUser) });
    },
  );

  router.post(
    '/admin/users',
    authenticate,
    requirePermission(access, 'users', 'create'),
    async (request, response): Promise<void> => {
      const input = parseUserInput(request.body);
      if (!input) {
        response.status(400).json({ message: 'Name, email, password, and a valid role are required.' });
        return;
      }
      try {
        const user = await access.createUser(input, request.authUser!);
        response.status(201).json({ user: publicUser(user) });
      } catch (error) {
        sendServiceError(response, error);
      }
    },
  );

  router.get(
    '/admin/users/:id/permissions',
    authenticate,
    requirePermission(access, 'users', 'view'),
    requireSuperadmin,
    async (request, response): Promise<void> => {
      const id = request.params['id'];
      if (typeof id !== 'string') {
        response.status(400).json({ message: 'A valid user id is required.' });
        return;
      }
      const user = await store.getUserById(id);
      if (!user) {
        response.status(404).json({ message: 'User not found.' });
        return;
      }
      response.json({ permissions: user.permissions ?? null });
    },
  );

  router.put(
    '/admin/users/:id/permissions',
    authenticate,
    requirePermission(access, 'users', 'edit'),
    requireSuperadmin,
    async (request, response): Promise<void> => {
      const id = request.params['id'];
      const body = request.body as Record<string, unknown> | undefined;
      if (typeof id !== 'string' || !body ||
          (body.permissions !== null && !validateRolePermissions(body.permissions))) {
        response.status(400).json({
          message: 'Provide a complete permission matrix or null to inherit role access.',
        });
        return;
      }
      try {
        const permissions = body.permissions as PermissionMatrix[Role] | null;
        const user = await access.updateUserPermissions(id, permissions, request.authUser!);
        response.json({ user: publicUser(user), permissions: user.permissions ?? null });
      } catch (error) {
        sendServiceError(response, error);
      }
    },
  );

  router.patch(
    '/admin/users/:id',
    authenticate,
    requirePermission(access, 'users', 'edit'),
    async (request, response): Promise<void> => {
      const input = parseUserUpdate(request.body);
      if (!input) {
        response.status(400).json({ message: 'A valid role and disabled state are required.' });
        return;
      }
      const id = request.params['id'];
      if (typeof id !== 'string') {
        response.status(400).json({ message: 'A valid user id is required.' });
        return;
      }
      try {
        const user = await access.updateUser(id, input, request.authUser!);
        response.json({ user: publicUser(user) });
      } catch (error) {
        sendServiceError(response, error);
      }
    },
  );

  router.get(
    '/admin/audit',
    authenticate,
    requirePermission(access, 'activity', 'view'),
    async (_request, response): Promise<void> => {
      const events: AuditEvent[] = await store.listAuditEvents();
      response.json({ events });
    },
  );

  return router;
}
