import express, { Router, type Response } from 'express5';
import {
  isRole,
  PAGES,
  ROLES,
  validateRolePermissions,
  type PermissionMatrix,
  type Role,
} from '../domain/permissions.js';
import type {
  AuditEvent,
  CompanyProfile,
  PlatformRegistration,
  PlatformRegistrationDetails,
  StoredUser,
} from '../domain/models.js';
import { InvalidProfileImageError, JsonStore, StoreConflictError } from '../infrastructure/json-store.js';
import { AccessControlService, InputError, NotFoundError } from '../services/access-control.js';
import { AuthenticationService, PasswordChangeError } from '../services/authentication.js';
import { SessionManager } from '../services/sessions.js';
import {
  readSessionCredential,
  requireAuth,
  requirePermission,
  requireSuperadmin,
} from './middleware.js';
import { Pool } from 'pg';

interface ApiDependencies {
  store: JsonStore;
  access: AccessControlService;
  authentication: AuthenticationService;
  sessions: SessionManager;
  secureCookies: boolean;
  localDemoCredentials?: { email: string; password: string } | null;
  platformDirectory?: {
    listRegistrations(): Promise<PlatformRegistration[]>;
    getRegistrationDetails(id: string): Promise<PlatformRegistrationDetails | null>;
  };
  operationsDirectory?: {
    getData(domain: string): Promise<unknown>;
  };
}

const OPERATION_PAGES: Record<string, string> = {
  jobs: 'jobs',
  livemonitor: 'livemonitor',
  verification: 'verification',
  disputes: 'disputes',
  companies: 'companies',
  amc: 'amc',
  finance: 'finance',
  invoices: 'invoices',
  inventory: 'inventory',
  repair: 'repair',
  projects: 'projects',
  analytics: 'analytics',
  'partner-app': 'partner-app',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function isLoopbackAddress(address: string | undefined): boolean {
  const normalized = address?.toLowerCase();
  if (!normalized) return false;
  return normalized === '::1' ||
    /^127(?:\.\d{1,3}){3}$/.test(normalized) ||
    /^::ffff:127(?:\.\d{1,3}){3}$/.test(normalized);
}

function publicUser(user: StoredUser) {
  if (!user.userCode) throw new Error('The user reference code is unavailable.');
  return {
    id: user.id,
    userCode: user.userCode,
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

function parseProfileInput(
  body: unknown,
): { name: string; phone: string | null; completeSetup?: boolean } | null {
  if (!isRecord(body) || typeof body.name !== 'string' ||
      Object.keys(body).some((key) => !['name', 'phone', 'completeSetup'].includes(key)) ||
      ('completeSetup' in body && typeof body.completeSetup !== 'boolean')) return null;
  const phone = body.phone;
  if (phone !== null && typeof phone !== 'string') return null;
  return {
    name: body.name,
    phone,
    ...(body.completeSetup === true ? { completeSetup: true } : {}),
  };
}

function parseCompanyProfileInput(body: unknown): CompanyProfile | null {
  if (!isRecord(body) ||
      typeof body.companyName !== 'string' ||
      typeof body.phone !== 'string' ||
      typeof body.email !== 'string' ||
      typeof body.gstin !== 'string' ||
      Object.keys(body).some((key) =>
        !['companyName', 'phone', 'email', 'gstin'].includes(key))) return null;

  const companyProfile: CompanyProfile = {
    companyName: body.companyName.trim(),
    phone: body.phone.trim(),
    email: body.email.trim().toLowerCase(),
    gstin: body.gstin.trim().toUpperCase(),
  };
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const gstinPattern = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
  const phonePattern = /^[+()\d.\-\s]+$/;
  if (companyProfile.companyName.length > 150 ||
      companyProfile.phone.length > 32 ||
      (companyProfile.phone.length > 0 &&
        (companyProfile.phone.length < 6 || !phonePattern.test(companyProfile.phone))) ||
      companyProfile.email.length > 254 ||
      (companyProfile.email.length > 0 && !emailPattern.test(companyProfile.email)) ||
      (companyProfile.gstin.length > 0 && !gstinPattern.test(companyProfile.gstin))) return null;
  return companyProfile;
}

function parsePasswordInput(body: unknown): { currentPassword: string; newPassword: string } | null {
  if (!isRecord(body) ||
      typeof body.currentPassword !== 'string' ||
      typeof body.newPassword !== 'string' ||
      Object.keys(body).some((key) => key !== 'currentPassword' && key !== 'newPassword')) return null;
  return { currentPassword: body.currentPassword, newPassword: body.newPassword };
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
  const {
    store,
    access,
    authentication,
    sessions,
    secureCookies,
    localDemoCredentials,
    platformDirectory,
    operationsDirectory,
  } = dependencies;
  const router = Router();
  const authenticate = requireAuth(store, sessions, access);
  const operationsPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
  });

  router.get(
    '/operations/overview',
    authenticate,
    requireSuperadmin,
    async (_request, response): Promise<void> => {
      const client = await operationsPool.connect();
      try {
        const [jobs, amcs, repairs, projects, inventory, companies] = await Promise.all([
          client.query(`SELECT id, code, title, status, priority, location_label,
                               engineer_name, estimate_amount, sla_due_at, created_at
                        FROM field_jobs ORDER BY created_at DESC LIMIT 100`),
          client.query(`SELECT id, contract_number, contract_type, status,
                               end_date, coverage, created_at
                        FROM amc_contracts ORDER BY created_at DESC LIMIT 100`),
          client.query(`SELECT id, ticket_number, device_id, status, priority,
                               issue_description, created_at
                        FROM repair_tickets ORDER BY created_at DESC LIMIT 100`),
          client.query(`SELECT id, request_number, title, status,
                               preferred_timeline, budget_amount, created_at
                        FROM project_requests ORDER BY created_at DESC LIMIT 100`),
          client.query(`SELECT id, sku, name, brand, stock_quantity, active
                        FROM products ORDER BY name LIMIT 100`),
          client.query(`SELECT id, company_name, gst_number, industry, city, status,
                               created_at
                        FROM companies ORDER BY created_at DESC LIMIT 100`),
        ]);
        response.json({
          jobs: jobs.rows,
          amcs: amcs.rows,
          repairs: repairs.rows,
          projects: projects.rows,
          inventory: inventory.rows,
          companies: companies.rows,
        });
      } finally {
        client.release();
      }
    },
  );

  router.patch(
    '/operations/jobs/:id/status',
    authenticate,
    requireSuperadmin,
    async (request, response): Promise<void> => {
      const status = (request.body as Record<string, unknown> | undefined)?.status;
      if (!['accepted', 'on_the_way', 'in_progress', 'completed', 'cancelled'].includes(String(status))) {
        response.status(400).json({ message: 'A valid job status is required.' });
        return;
      }
      const engineerName = (request.body as Record<string, unknown> | undefined)?.engineerName;
      const result = await operationsPool.query(
        `UPDATE field_jobs
         SET status = $2,
             engineer_name = CASE WHEN $3::text IS NULL THEN engineer_name ELSE $3::text END,
             updated_at = NOW()
         WHERE id::text = $1 OR code = $1
         RETURNING id, code, title, status, engineer_name`,
        [request.params['id'], status, typeof engineerName === 'string' ? engineerName : null],
      );
      if (!result.rowCount) {
        response.status(404).json({ message: 'Job not found.' });
        return;
      }
      response.json({ job: result.rows[0] });
    },
  );

  router.patch(
    '/operations/amc/:id/status',
    authenticate,
    requireSuperadmin,
    async (request, response): Promise<void> => {
      const status = (request.body as Record<string, unknown> | undefined)?.status;
      if (!['active', 'suspended', 'expired', 'cancelled'].includes(String(status))) {
        response.status(400).json({ message: 'A valid AMC status is required.' });
        return;
      }
      const result = await operationsPool.query(
        `UPDATE amc_contracts SET status = $2, updated_at = NOW()
         WHERE id = $1
         RETURNING id, contract_number, status`,
        [request.params['id'], status],
      );
      if (!result.rowCount) {
        response.status(404).json({ message: 'AMC contract not found.' });
        return;
      }
      response.json({ amc: result.rows[0] });
    },
  );

  router.patch(
    '/operations/repairs/:id/status',
    authenticate,
    requireSuperadmin,
    async (request, response): Promise<void> => {
      const status = (request.body as Record<string, unknown> | undefined)?.status;
      if (!['received', 'diagnosis', 'estimate_required', 'approved', 'repair_in_progress', 'ready', 'returned', 'completed', 'cancelled'].includes(String(status))) {
        response.status(400).json({ message: 'A valid repair status is required.' });
        return;
      }
      const result = await operationsPool.query(
        `UPDATE repair_tickets SET status = $2, updated_at = NOW()
         WHERE id = $1
         RETURNING id, ticket_number, status`,
        [request.params['id'], status],
      );
      if (!result.rowCount) {
        response.status(404).json({ message: 'Repair ticket not found.' });
        return;
      }
      response.json({ repair: result.rows[0] });
    },
  );

  router.patch(
    '/operations/projects/:id/status',
    authenticate,
    requireSuperadmin,
    async (request, response): Promise<void> => {
      const status = (request.body as Record<string, unknown> | undefined)?.status;
      if (!['under_review', 'clarification_required', 'approved', 'in_progress', 'completed', 'cancelled'].includes(String(status))) {
        response.status(400).json({ message: 'A valid project status is required.' });
        return;
      }
      const result = await operationsPool.query(
        `UPDATE project_requests SET status = $2, updated_at = NOW()
         WHERE id = $1
         RETURNING id, request_number, title, status`,
        [request.params['id'], status],
      );
      if (!result.rowCount) {
        response.status(404).json({ message: 'Project request not found.' });
        return;
      }
      response.json({ project: result.rows[0] });
    },
  );

  router.patch(
    '/operations/companies/:id/status',
    authenticate,
    requireSuperadmin,
    async (request, response): Promise<void> => {
      const status = (request.body as Record<string, unknown> | undefined)?.status;
      if (!['active', 'inactive', 'suspended'].includes(String(status))) {
        response.status(400).json({ message: 'A valid company status is required.' });
        return;
      }
      const result = await operationsPool.query(
        `UPDATE companies SET status = $2, updated_at = NOW()
         WHERE id = $1
         RETURNING id, company_name, gst_number, status`,
        [request.params['id'], status],
      );
      if (!result.rowCount) {
        response.status(404).json({ message: 'Company not found.' });
        return;
      }
      response.json({ company: result.rows[0] });
    },
  );
  router.get(
    '/admin/operations/:domain',
    authenticate,
    async (request, response): Promise<void> => {
      const domain = request.params['domain'];
      const page = typeof domain === 'string' ? OPERATION_PAGES[domain] : undefined;
      if (!page) {
        response.status(404).json({ message: 'The operations data source was not found.' });
        return;
      }
      if (!(await access.can(request.authUser!, page, 'view'))) {
        response.status(403).json({ message: 'You do not have permission to view this operations data.' });
        return;
      }
      if (!operationsDirectory) {
        response.status(503).json({ message: 'The operations database is unavailable.' });
        return;
      }
      const data = await operationsDirectory.getData(domain);
      if (!data) {
        response.status(404).json({ message: 'The operations data source was not found.' });
        return;
      }
      response.json(data);
    },
  );

  router.get('/auth/local-demo', (request, response): void => {
    const isLocalRequest = isLoopbackAddress(request.socket.remoteAddress);
    response.json(localDemoCredentials && isLocalRequest
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
    if (
      localDemoCredentials &&
      body.email.trim().toLowerCase() === localDemoCredentials.email &&
      !isLoopbackAddress(request.socket.remoteAddress)
    ) {
      response.status(401).json({ message: 'Invalid email or password.' });
      return;
    }

    const user = await authentication.authenticate(body.email, body.password, request.ip ?? 'unknown');
    if (!user) {
      response.status(401).json({ message: 'Invalid email or password.' });
      return;
    }

    const session = sessions.create(user.id);
    response.json({
      user: await access.sessionUser(user),
      expiresAt: session.expiresAt,
      impersonation: null,
      sessionToken: session.id,
    });
  });

  router.get('/auth/me', async (request, response): Promise<void> => {
    const credential = readSessionCredential(request.headers.cookie, request.headers.authorization);
    const sessionId = credential.sessionId;
    const session = sessionId ? sessions.get(sessionId) : undefined;
    const user = session ? await store.getUserById(session.userId) : undefined;
    if (!sessionId || !session || !user || user.disabled ||
        (session.impersonatedBy && user.role === 'superadmin')) {
      if (sessionId && session) sessions.revoke(sessionId);
      response.json({ user: null, expiresAt: null });
      return;
    }
    let impersonation: { actorId: string; actorName: string; actorEmail: string } | null = null;
    if (session.impersonatedBy) {
      const actor = await store.getUserById(session.impersonatedBy.id);
      if (!actor || actor.disabled || actor.role !== 'superadmin' ||
          !(await access.can(actor, 'users', 'view')) ||
          !(await access.can(actor, 'users', 'edit'))) {
        sessions.revoke(sessionId);
        response.json({ user: null, expiresAt: null });
        return;
      }
      impersonation = {
        actorId: session.impersonatedBy.id,
        actorName: session.impersonatedBy.name,
        actorEmail: session.impersonatedBy.email,
      };
    }
    response.json({
      user: await access.sessionUser(user),
      expiresAt: session.expiresAt,
      impersonation,
    });
  });

  router.post(
    '/auth/impersonation/exchange',
    async (request, response): Promise<void> => {
      const body = request.body as Record<string, unknown> | undefined;
      if (!body || typeof body.token !== 'string' || !/^[A-Za-z0-9_-]{40,60}$/.test(body.token)) {
        response.status(400).json({ message: 'A valid one-time launch token is required.' });
        return;
      }
      const launch = sessions.consumeImpersonationLaunch(body.token);
      if (!launch) {
        response.status(401).json({ message: 'This user-panel link is invalid or has expired.' });
        return;
      }
      const actor = await store.getUserById(launch.actorId);
      const target = await store.getUserById(launch.targetId);
      if (!actor || actor.disabled || actor.role !== 'superadmin' ||
          !(await access.can(actor, 'users', 'view')) ||
          !(await access.can(actor, 'users', 'edit'))) {
        response.status(403).json({ message: 'The Superadmin no longer has permission to open user panels.' });
        return;
      }
      if (!target || target.disabled || target.role === 'superadmin' || target.id === actor.id) {
        response.status(403).json({ message: 'This account cannot be opened as a user panel.' });
        return;
      }
      await store.recordAudit(actor, 'auth.impersonation_started', 'user', target.id, {
        impersonatedUserEmail: target.email,
        expiresInMinutes: 30,
      });
      const session = sessions.createImpersonationSession(target.id, {
        id: actor.id,
        name: actor.name,
        email: actor.email,
      });
      response.json({
        sessionToken: session.id,
        user: await access.sessionUser(target),
        expiresAt: session.expiresAt,
        impersonation: {
          actorId: actor.id,
          actorName: actor.name,
          actorEmail: actor.email,
        },
      });
    },
  );

  router.patch('/auth/profile', authenticate, async (request, response): Promise<void> => {
    const input = parseProfileInput(request.body);
    if (!input) {
      response.status(400).json({ message: 'A name and phone number are required.' });
      return;
    }
    if (input.completeSetup && request.authSession?.impersonatedBy) {
      response.status(403).json({ message: 'Admin profile setup must be completed from the assigned account.' });
      return;
    }
    try {
      const user = await access.updateProfile(request.authUser!, input);
      response.json({ user: await access.sessionUser(user) });
    } catch (error) {
      sendServiceError(response, error);
    }
  });

  router.get('/auth/profile/company', authenticate, async (_request, response): Promise<void> => {
    response.json({ companyProfile: await store.getCompanyProfile() });
  });

  router.patch(
    '/auth/profile/company',
    authenticate,
    requirePermission(access, 'settings', 'edit'),
    async (request, response): Promise<void> => {
      const input = parseCompanyProfileInput(request.body);
      if (!input) {
        response.status(400).json({ message: 'Enter a valid company name, phone, email, and GSTIN.' });
        return;
      }
      response.json({ companyProfile: await store.updateCompanyProfile(input, request.authUser!) });
    },
  );

  router.post('/auth/profile/password', authenticate, async (request, response): Promise<void> => {
    if (request.authSession?.impersonatedBy) {
      response.status(403).json({ message: 'Password changes are unavailable while viewing another account.' });
      return;
    }
    const input = parsePasswordInput(request.body);
    if (!input) {
      response.status(400).json({ message: 'Current and new passwords are required.' });
      return;
    }
    const currentSessionId = request.authSessionId;
    if (!currentSessionId) {
      response.status(401).json({ message: 'Authentication required.' });
      return;
    }
    try {
      await authentication.changePassword(
        request.authUser!,
        input.currentPassword,
        input.newPassword,
      );
    } catch (error) {
      if (error instanceof PasswordChangeError) {
        response.status(400).json({ message: error.message });
        return;
      }
      throw error;
    }
    sessions.revokeOtherSessions(request.authUser!.id, currentSessionId);
    response.status(204).end();
  });

  router.put(
    '/auth/profile/avatar',
    authenticate,
    express.raw({
      type: ['image/jpeg', 'image/png', 'image/webp'],
      limit: '512kb',
    }),
    async (request, response): Promise<void> => {
      const contentType = request.get('content-type')?.split(';', 1)[0];
      if (!Buffer.isBuffer(request.body) ||
          (contentType !== 'image/jpeg' && contentType !== 'image/png' && contentType !== 'image/webp')) {
        response.status(400).json({ message: 'Upload a JPEG, PNG, or WebP profile photo.' });
        return;
      }
      try {
        const user = await store.updateAvatar(
          request.authUser!.id,
          { contentType, bytes: request.body },
          request.authUser!,
        );
        if (!user) {
          response.status(404).json({ message: 'User not found.' });
          return;
        }
        response.json({ user: await access.sessionUser(user) });
      } catch (error) {
        if (error instanceof InvalidProfileImageError) {
          response.status(400).json({ message: error.message });
          return;
        }
        throw error;
      }
    },
  );

  router.get('/auth/profile/avatar', authenticate, async (request, response): Promise<void> => {
    const avatar = await store.getAvatar(request.authUser!.id);
    if (!avatar) {
      response.status(404).json({ message: 'No profile photo is set.' });
      return;
    }
    response.setHeader('Content-Type', avatar.contentType);
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.send(avatar.bytes);
  });

  router.delete('/auth/profile/avatar', authenticate, async (request, response): Promise<void> => {
    const user = await store.updateAvatar(request.authUser!.id, null, request.authUser!);
    if (!user) {
      response.status(404).json({ message: 'User not found.' });
      return;
    }
    response.json({ user: await access.sessionUser(user) });
  });

  router.post('/auth/logout', authenticate, async (request, response): Promise<void> => {
    const user = request.authUser!;
    const sessionId = request.authSessionId;
    if (sessionId) sessions.revoke(sessionId);
    await authentication.recordLogout(user);
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
    '/admin/users/:id/impersonation',
    authenticate,
    requirePermission(access, 'users', 'view'),
    requirePermission(access, 'users', 'edit'),
    requireSuperadmin,
    async (request, response): Promise<void> => {
      const id = request.params['id'];
      if (typeof id !== 'string') {
        response.status(400).json({ message: 'A valid user id is required.' });
        return;
      }
      const actor = request.authUser!;
      const target = await store.getUserById(id);
      if (!target || target.disabled || target.role === 'superadmin' || target.id === actor.id) {
        response.status(403).json({ message: 'This account cannot be opened as a user panel.' });
        return;
      }
      const launch = sessions.createImpersonationLaunch(actor.id, target.id);
      await store.recordAudit(actor, 'auth.impersonation_link_created', 'user', target.id, {
        expiresInSeconds: 60,
      });
      response.json({ launchToken: launch.token, expiresAt: launch.expiresAt });
    },
  );

  router.get(
    '/admin/registrations/:id',
    authenticate,
    requirePermission(access, 'directory', 'view'),
    async (request, response): Promise<void> => {
      if (!platformDirectory) {
        response.status(503).json({ message: 'The platform registration directory is unavailable.' });
        return;
      }
      const details = await platformDirectory.getRegistrationDetails(request.params['id']);
      if (!details) {
        response.status(404).json({ message: 'The registered account was not found.' });
        return;
      }
      response.json({ details });
    },
  );

  router.post(
    '/admin/registrations/:id/review',
    authenticate,
    requirePermission(access, 'directory', 'edit'),
    async (request, response, next): Promise<void> => {
      if (request.authUser?.role !== 'superadmin') {
        response.status(403).json({ message: 'Only a Superadmin can review registrations.' });
        return;
      }
      if (!platformDirectory) {
        response.status(503).json({ message: 'The platform registration directory is unavailable.' });
        return;
      }
      const decision = request.body?.decision;
      const reason = typeof request.body?.reason === 'string' ? request.body.reason : '';
      if (!['approved', 'rejected'].includes(decision)) {
        response.status(400).json({ message: 'Choose approve or reject.' });
        return;
      }
      try {
        const registration = await platformDirectory.reviewRegistration(request.params['id'], { decision, reason });
        if (!registration) {
          response.status(404).json({ message: 'The registered account was not found.' });
          return;
        }
        await store.recordAudit(
          request.authUser!,
          `registration.${decision}`,
          'registration',
          request.params['id'],
          { reason: decision === 'rejected' ? reason.trim() : null, status: registration.status },
        );
        response.json({ registration });
      } catch (error) {
        if (error && typeof error === 'object' && 'statusCode' in error) {
          const statusCode = Number((error as { statusCode: unknown }).statusCode);
          if (Number.isInteger(statusCode) && statusCode >= 400 && statusCode < 600) {
            response.status(statusCode).json({ message: (error as Error).message });
            return;
          }
        }
        next(error);
      }
    },
  );

  router.get(
    '/admin/registrations',
    authenticate,
    requirePermission(access, 'directory', 'view'),
    async (_request, response): Promise<void> => {
      if (!platformDirectory) {
        response.status(503).json({ message: 'The platform registration directory is unavailable.' });
        return;
      }
      response.json({ registrations: await platformDirectory.listRegistrations() });
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

  router.delete(
    '/admin/users/:id',
    authenticate,
    requirePermission(access, 'users', 'delete'),
    requireSuperadmin,
    async (request, response): Promise<void> => {
      const id = request.params['id'];
      if (typeof id !== 'string') {
        response.status(400).json({ message: 'A valid user id is required.' });
        return;
      }
      try {
        await access.deleteUser(id, request.authUser!);
        sessions.revokeUserAccess(id);
        response.status(204).end();
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
