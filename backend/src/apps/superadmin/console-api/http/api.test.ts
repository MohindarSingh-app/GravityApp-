import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import test from 'node:test';
import type { AddressInfo } from 'node:net';
import { createApp } from '../app.js';
import { JsonStore } from '../infrastructure/json-store.js';
import { AccessControlService } from '../services/access-control.js';
import { AuthenticationService } from '../services/authentication.js';
import { hashPassword } from '../services/passwords.js';
import { SessionManager } from '../services/sessions.js';

test('API protects user administration and audits denied access', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'energy-hub-api-'));
  const store = new JsonStore(join(directory, 'access-control.json'));
  const superadminPassword = 'Superadmin-password-123';
  const superadminCredentials = hashPassword(superadminPassword);
  const demoPassword = 'Local-demo-password-123';
  const demoCredentials = hashPassword(demoPassword);
  await store.initialize({
    email: 'root@example.com',
    name: 'Root User',
    passwordSalt: superadminCredentials.salt,
    passwordHash: superadminCredentials.hash,
  });
  await store.ensureLocalDemoSuperadmin({
    name: 'Local Demo Superadmin',
    email: 'demo-admin@localhost.test',
    passwordSalt: demoCredentials.salt,
    passwordHash: demoCredentials.hash,
  });

  const access = new AccessControlService(store);
  const root = (await store.getUserByEmail('root@example.com'))!;
  await access.createUser({
    name: 'Read Only',
    email: 'viewer@example.com',
    password: 'Viewer-password-123',
    role: 'viewer',
  }, root);

  const app = createApp({
    store,
    access,
    authentication: new AuthenticationService(store),
    sessions: new SessionManager(),
    frontendOrigins: ['http://localhost:4200'],
    secureCookies: false,
    localDemoCredentials: {
      email: 'demo-admin@localhost.test',
      password: demoPassword,
    },
  });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}/api`;

  try {
    const demoInfo = await fetch(`${baseUrl}/auth/local-demo`);
    assert.equal(demoInfo.status, 200);
    assert.deepEqual(await demoInfo.json(), {
      enabled: true,
      credentials: {
        email: 'demo-admin@localhost.test',
        password: demoPassword,
      },
    });

    const anonymousSession = await fetch(`${baseUrl}/auth/me`);
    assert.equal(anonymousSession.status, 200);
    assert.deepEqual(await anonymousSession.json(), { user: null, expiresAt: null });

    const unauthenticated = await fetch(`${baseUrl}/admin/users`);
    assert.equal(unauthenticated.status, 401);

    const login = async (email: string, password: string): Promise<string> => {
      const response = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      assert.equal(response.status, 200);
      const cookie = response.headers.get('set-cookie')?.split(';')[0];
      if (!cookie?.startsWith('eh_session=')) throw new Error('Expected an authenticated session cookie.');
      return cookie;
    };

    const rootCookie = await login('root@example.com', superadminPassword);
    const expiresResponse = await fetch(`${baseUrl}/auth/me`, {
      headers: { cookie: rootCookie },
    });
    const sessionInfo = await expiresResponse.json() as { expiresAt: number };
    assert.equal(expiresResponse.status, 200);
    assert.ok(sessionInfo.expiresAt > Date.now());
    assert.ok(sessionInfo.expiresAt <= Date.now() + 8 * 60 * 60 * 1000 + 1000);

    const demoCookie = await login('demo-admin@localhost.test', demoPassword);
    const demoUsers = await fetch(`${baseUrl}/admin/users`, {
      headers: { cookie: demoCookie },
    });
    assert.equal(demoUsers.status, 200);

    const allowed = await fetch(`${baseUrl}/admin/users`, {
      headers: { cookie: rootCookie },
    });
    assert.equal(allowed.status, 200);

    const viewerCookie = await login('viewer@example.com', 'Viewer-password-123');
    const denied = await fetch(`${baseUrl}/admin/users`, {
      headers: { cookie: viewerCookie },
    });
    assert.equal(denied.status, 403);
    assert.ok((await store.listAuditEvents()).some((event) => event.action === 'auth.permission_denied'));

    const permissions = await store.getPermissions();
    permissions.viewer.users.view = true;
    permissions.viewer.users.create = true;
    const permissionUpdate = await fetch(`${baseUrl}/access/roles/viewer`, {
      method: 'PUT',
      headers: { cookie: rootCookie, 'content-type': 'application/json' },
      body: JSON.stringify({ permissions: permissions.viewer }),
    });
    assert.equal(permissionUpdate.status, 200);

    const newlyAllowed = await fetch(`${baseUrl}/admin/users`, {
      headers: { cookie: viewerCookie },
    });
    assert.equal(newlyAllowed.status, 200);

    const privilegeEscalation = await fetch(`${baseUrl}/admin/users`, {
      method: 'POST',
      headers: { cookie: viewerCookie, 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Elevated Account',
        email: 'elevated@example.com',
        password: 'Elevated-account-password-123',
        role: 'admin',
      }),
    });
    assert.equal(privilegeEscalation.status, 400);
    permissions.viewer.users.create = false;
    const removeCreatePermission = await fetch(`${baseUrl}/access/roles/viewer`, {
      method: 'PUT',
      headers: { cookie: rootCookie, 'content-type': 'application/json' },
      body: JSON.stringify({ permissions: permissions.viewer }),
    });
    assert.equal(removeCreatePermission.status, 200);

    const created = await fetch(`${baseUrl}/admin/users`, {
      method: 'POST',
      headers: { cookie: rootCookie, 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'New Account',
        email: 'new@example.com',
        password: 'New-account-password-123',
        role: 'viewer',
      }),
    });
    assert.equal(created.status, 201);
    const createdBody = await created.json() as { user: Record<string, unknown> };
    assert.equal(createdBody.user['email'], 'new@example.com');
    assert.equal('passwordHash' in createdBody.user, false);
    assert.equal(createdBody.user['customAccess'], false);

    const newUserId = createdBody.user['id'];
    assert.equal(typeof newUserId, 'string');
    const individualAccess = await fetch(`${baseUrl}/admin/users/${newUserId}/permissions`, {
      method: 'PUT',
      headers: { cookie: rootCookie, 'content-type': 'application/json' },
      body: JSON.stringify({
        permissions: {
          ...permissions.viewer,
          jobs: { view: true, create: false, edit: true, delete: false },
        },
      }),
    });
    assert.equal(individualAccess.status, 200);
    assert.equal((await store.getUserById(newUserId as string))?.permissions?.jobs.edit, true);

    const newUserCookie = await login('new@example.com', 'New-account-password-123');
    const newUserSession = await fetch(`${baseUrl}/auth/me`, {
      headers: { cookie: newUserCookie },
    });
    const newUserSessionBody = await newUserSession.json() as {
      user: { permissions: { jobs: { edit: boolean } } };
    };
    assert.equal(newUserSessionBody.user.permissions.jobs.edit, true);

    const resetToRoleDefaults = await fetch(`${baseUrl}/admin/users/${newUserId}/permissions`, {
      method: 'PUT',
      headers: { cookie: rootCookie, 'content-type': 'application/json' },
      body: JSON.stringify({ permissions: null }),
    });
    assert.equal(resetToRoleDefaults.status, 200);
    assert.equal((await store.getUserById(newUserId as string))?.permissions, undefined);
    const inheritedUserSession = await fetch(`${baseUrl}/auth/me`, {
      headers: { cookie: newUserCookie },
    });
    const inheritedSessionBody = await inheritedUserSession.json() as {
      user: { permissions: { jobs: { edit: boolean } } };
    };
    assert.equal(inheritedSessionBody.user.permissions.jobs.edit, false);

    const auditActions = (await store.listAuditEvents()).map((event) => event.action);
    assert.ok(auditActions.includes('permissions.updated'));
    assert.ok(auditActions.includes('user.created'));
    assert.ok(auditActions.includes('user.permissions_updated'));
  } finally {
    server.close();
    await once(server, 'close');
    await rm(directory, { recursive: true, force: true });
  }
});

test('local demo credentials are not returned when the feature is disabled', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'energy-hub-api-no-demo-'));
  const store = new JsonStore(join(directory, 'access-control.json'));
  const credentials = hashPassword('Superadmin-password-123');
  await store.initialize({
    email: 'root@example.com',
    name: 'Root User',
    passwordSalt: credentials.salt,
    passwordHash: credentials.hash,
  });
  const app = createApp({
    store,
    access: new AccessControlService(store),
    authentication: new AuthenticationService(store),
    sessions: new SessionManager(),
    frontendOrigins: ['http://localhost:4200'],
    secureCookies: false,
  });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address() as AddressInfo;

  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/api/auth/local-demo`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { enabled: false });
  } finally {
    server.close();
    await once(server, 'close');
    await rm(directory, { recursive: true, force: true });
  }
});
