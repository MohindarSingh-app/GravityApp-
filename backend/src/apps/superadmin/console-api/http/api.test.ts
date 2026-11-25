import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
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
import { isLoopbackAddress } from './routes.js';

test('local demo access recognizes loopback addresses only', () => {
  assert.equal(isLoopbackAddress('127.0.0.1'), true);
  assert.equal(isLoopbackAddress('::1'), true);
  assert.equal(isLoopbackAddress('::ffff:127.0.0.1'), true);
  assert.equal(isLoopbackAddress('192.168.1.10'), false);
  assert.equal(isLoopbackAddress(undefined), false);
});

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
  const restrictedSuperadminPassword = 'Scoped-superadmin-password-123';
  const restrictedSuperadmin = await access.createUser({
    name: 'Scoped Superadmin',
    email: 'scoped-root@example.com',
    password: restrictedSuperadminPassword,
    role: 'superadmin',
  }, root);
  const restrictedSuperadminPermissions = structuredClone((await store.getPermissions()).superadmin);
  for (const pagePermissions of Object.values(restrictedSuperadminPermissions)) {
    pagePermissions.view = false;
    pagePermissions.create = false;
    pagePermissions.edit = false;
    pagePermissions.delete = false;
  }
  restrictedSuperadminPermissions.jobs.view = true;
  await access.updateUserPermissions(
    restrictedSuperadmin.id,
    restrictedSuperadminPermissions,
    root,
  );
  const scopedManagerPassword = 'Scoped-manager-password-123';
  const scopedManager = await access.createUser({
    name: 'Scoped Manager',
    email: 'scoped-manager@example.com',
    password: scopedManagerPassword,
    role: 'superadmin',
  }, root);
  const scopedManagerPermissions = structuredClone((await store.getPermissions()).superadmin);
  for (const pagePermissions of Object.values(scopedManagerPermissions)) {
    pagePermissions.view = false;
    pagePermissions.create = false;
    pagePermissions.edit = false;
    pagePermissions.delete = false;
  }
  scopedManagerPermissions.jobs.view = true;
  scopedManagerPermissions.users.view = true;
  scopedManagerPermissions.users.create = true;
  scopedManagerPermissions.users.edit = true;
  await access.updateUserPermissions(scopedManager.id, scopedManagerPermissions, root);
  await access.createUser({
    name: 'Read Only',
    email: 'viewer@example.com',
    password: 'Viewer-password-123',
    role: 'viewer',
  }, root);
  const firstLoginAdminPassword = 'First-login-admin-password-123';
  await access.createUser({
    name: 'New Admin',
    email: 'new-admin@example.com',
    password: firstLoginAdminPassword,
    role: 'admin',
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
    platformDirectory: {
      async listRegistrations() {
        return [{
          id: 'energy-hub:1',
          registrationId: 'EN-PARTNER-10001',
          app: 'energy-hub',
          name: 'Sample Partner',
          email: null,
          phone: null,
          role: 'service_partner',
          status: 'approved',
          registeredAt: null,
          profile: {
            businessName: null,
            companyName: null,
            registeredAddress: null,
            serviceAreas: [],
            specializations: [],
            experienceYears: null,
            qualification: null,
            online: false,
            busy: false,
            completedServices: 0,
            totalServices: 0,
            totalEarnings: 0,
            pendingEarnings: 0,
            rating: null,
            ratingCount: null,
            ratings: [],
            latestService: null,
          },
        }];
      },
      async getRegistrationDetails() {
        return null;
      },
    },
    operationsDirectory: {
      async getData(domain: string) {
        return { items: [], sourceStatus: 'connected', domain };
      },
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
    const unauthenticatedOperations = await fetch(`${baseUrl}/admin/operations/jobs`);
    assert.equal(unauthenticatedOperations.status, 401);

    const login = async (email: string, password: string): Promise<string> => {
      const response = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      assert.equal(response.status, 200);
      const result = await response.json() as { sessionToken: string };
      if (!result.sessionToken) throw new Error('Expected an authenticated bearer session.');
      return `eh_session=${result.sessionToken}`;
    };

    let rootCookie = await login('root@example.com', superadminPassword);
    const rootOperations = await fetch(`${baseUrl}/admin/operations/jobs`, {
      headers: { cookie: rootCookie },
    });
    assert.equal(rootOperations.status, 200);
    assert.deepEqual(await rootOperations.json(), {
      items: [],
      sourceStatus: 'connected',
      domain: 'jobs',
    });
    const revokedRootCookie = rootCookie;
    const rootOtherSessionCookie = await login('root@example.com', superadminPassword);
    rootCookie = rootOtherSessionCookie;
    const invalidProfileUpdate = await fetch(`${baseUrl}/auth/profile`, {
      method: 'PATCH',
      headers: { cookie: rootCookie, 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Root User',
        phone: null,
        email: 'changed@example.com',
      }),
    });
    assert.equal(invalidProfileUpdate.status, 400);

    const profileUpdate = await fetch(`${baseUrl}/auth/profile`, {
      method: 'PATCH',
      headers: { cookie: rootCookie, 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Updated Root User', phone: '+91 98765 43210' }),
    });
    assert.equal(profileUpdate.status, 200);
    const updatedProfile = await profileUpdate.json() as {
      user: { name: string; email: string; phone: string; avatarUrl: string | null };
    };
    assert.equal(updatedProfile.user.name, 'Updated Root User');
    assert.equal(updatedProfile.user.email, 'root@example.com');
    assert.equal(updatedProfile.user.phone, '+91 98765 43210');
    assert.equal(updatedProfile.user.avatarUrl, null);

    const firstLoginAdminCookie = await login('new-admin@example.com', firstLoginAdminPassword);
    const firstLoginAdminSession = await fetch(`${baseUrl}/auth/me`, {
      headers: { cookie: firstLoginAdminCookie },
    });
    const firstLoginAdminUser = (await firstLoginAdminSession.json() as {
      user: { profileSetupRequired: boolean; avatarUrl: string | null };
    }).user;
    assert.equal(firstLoginAdminUser.profileSetupRequired, true);

    const incompleteSetup = await fetch(`${baseUrl}/auth/profile`, {
      method: 'PATCH',
      headers: { cookie: firstLoginAdminCookie, 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'New Admin',
        phone: '+91 98765 43210',
        completeSetup: true,
      }),
    });
    assert.equal(incompleteSetup.status, 400);

    const adminAvatar = await fetch(`${baseUrl}/auth/profile/avatar`, {
      method: 'PUT',
      headers: { cookie: firstLoginAdminCookie, 'content-type': 'image/png' },
      body: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    });
    assert.equal(adminAvatar.status, 200);

    const completedSetup = await fetch(`${baseUrl}/auth/profile`, {
      method: 'PATCH',
      headers: { cookie: firstLoginAdminCookie, 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'New Admin Updated',
        phone: '+91 98765 43210',
        completeSetup: true,
      }),
    });
    assert.equal(completedSetup.status, 200);
    const completedAdminUser = (await completedSetup.json() as {
      user: { profileSetupRequired: boolean; name: string; email: string; phone: string };
    }).user;
    assert.equal(completedAdminUser.profileSetupRequired, false);
    assert.equal(completedAdminUser.name, 'New Admin Updated');
    assert.equal(completedAdminUser.email, 'new-admin@example.com');
    assert.equal(completedAdminUser.phone, '+91 98765 43210');

    const companyDefaults = await fetch(`${baseUrl}/auth/profile/company`, {
      headers: { cookie: rootCookie },
    });
    assert.equal(companyDefaults.status, 200);
    assert.deepEqual((await companyDefaults.json() as { companyProfile: Record<string, string> })
      .companyProfile, {
      companyName: '',
      phone: '',
      email: '',
      gstin: '',
    });
    const companyUpdate = await fetch(`${baseUrl}/auth/profile/company`, {
      method: 'PATCH',
      headers: { cookie: rootCookie, 'content-type': 'application/json' },
      body: JSON.stringify({
        companyName: 'Gravity Energy',
        phone: '',
        email: '',
        gstin: '',
      }),
    });
    assert.equal(companyUpdate.status, 200);
    assert.deepEqual((await companyUpdate.json() as { companyProfile: Record<string, string> })
      .companyProfile, {
      companyName: 'Gravity Energy',
      phone: '',
      email: '',
      gstin: '',
    });
    const invalidCompanyUpdate = await fetch(`${baseUrl}/auth/profile/company`, {
      method: 'PATCH',
      headers: { cookie: rootCookie, 'content-type': 'application/json' },
      body: JSON.stringify({
        companyName: 'Gravity Energy',
        phone: '',
        email: '',
        gstin: 'not-a-gstin',
      }),
    });
    assert.equal(invalidCompanyUpdate.status, 400);

    const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const avatarUpload = await fetch(`${baseUrl}/auth/profile/avatar`, {
      method: 'PUT',
      headers: { cookie: rootCookie, 'content-type': 'image/png' },
      body: pngSignature,
    });
    assert.equal(avatarUpload.status, 200);
    const uploadedProfile = await avatarUpload.json() as {
      user: { avatarUrl: string | null; updatedAt: string };
    };
    assert.equal(
      uploadedProfile.user.avatarUrl,
      `/api/superadmin/console/auth/profile/avatar?v=${encodeURIComponent(uploadedProfile.user.updatedAt)}`,
    );

    const avatarResponse = await fetch(`${baseUrl}/auth/profile/avatar`, {
      headers: { cookie: rootCookie },
    });
    assert.equal(avatarResponse.status, 200);
    assert.equal(avatarResponse.headers.get('content-type'), 'image/png');
    assert.deepEqual(Buffer.from(await avatarResponse.arrayBuffer()), pngSignature);

    const reopenedStore = new JsonStore(join(directory, 'access-control.json'));
    await reopenedStore.initialize({
      email: 'ignored@example.com',
      name: 'Ignored User',
      passwordSalt: 'ignored',
      passwordHash: 'ignored',
    });
    assert.equal((await reopenedStore.getUserByEmail('root@example.com'))?.phone, '+91 98765 43210');
    assert.equal((await reopenedStore.getCompanyProfile()).companyName, 'Gravity Energy');
    assert.deepEqual((await reopenedStore.getAvatar(root.id))?.bytes, pngSignature);

    const invalidAvatar = await fetch(`${baseUrl}/auth/profile/avatar`, {
      method: 'PUT',
      headers: { cookie: rootCookie, 'content-type': 'image/png' },
      body: Buffer.from('not an image'),
    });
    assert.equal(invalidAvatar.status, 400);
    const oversizedAvatar = await fetch(`${baseUrl}/auth/profile/avatar`, {
      method: 'PUT',
      headers: { cookie: rootCookie, 'content-type': 'image/png' },
      body: Buffer.concat([pngSignature, Buffer.alloc(512 * 1024)]),
    });
    assert.equal(oversizedAvatar.status, 413);

    const avatarRemoval = await fetch(`${baseUrl}/auth/profile/avatar`, {
      method: 'DELETE',
      headers: { cookie: rootCookie },
    });
    assert.equal(avatarRemoval.status, 200);
    assert.equal(
      (await avatarRemoval.json() as { user: { avatarUrl: string | null } }).user.avatarUrl,
      null,
    );

    const expiresResponse = await fetch(`${baseUrl}/auth/me`, {
      headers: { cookie: rootCookie },
    });
    const sessionInfo = await expiresResponse.json() as { expiresAt: number };
    assert.equal(expiresResponse.status, 200);
    assert.ok(sessionInfo.expiresAt > Date.now());
    assert.ok(sessionInfo.expiresAt <= Date.now() + 8 * 60 * 60 * 1000 + 1000);

    const selfAccessUpdate = await fetch(`${baseUrl}/admin/users/${root.id}/permissions`, {
      method: 'PUT',
      headers: { cookie: rootCookie, 'content-type': 'application/json' },
      body: JSON.stringify({ permissions: restrictedSuperadminPermissions }),
    });
    assert.equal(selfAccessUpdate.status, 400);

    const restrictedSuperadminCookie = await login(
      'scoped-root@example.com',
      restrictedSuperadminPassword,
    );
    const restrictedJobs = await fetch(`${baseUrl}/admin/operations/jobs`, {
      headers: { cookie: restrictedSuperadminCookie },
    });
    assert.equal(restrictedJobs.status, 200);
    const restrictedAnalytics = await fetch(`${baseUrl}/admin/operations/analytics`, {
      headers: { cookie: restrictedSuperadminCookie },
    });
    assert.equal(restrictedAnalytics.status, 403);
    const restrictedSuperadminSession = await fetch(`${baseUrl}/auth/me`, {
      headers: { cookie: restrictedSuperadminCookie },
    });
    const restrictedSuperadminSessionBody = await restrictedSuperadminSession.json() as {
      user: {
        role: string;
        accessMode: string;
        permissionsAssignedBy: { name: string; email: string } | null;
        permissions: {
          jobs: { view: boolean };
          directory: { view: boolean };
          users: { view: boolean };
        };
      };
    };
    assert.equal(restrictedSuperadminSessionBody.user.role, 'superadmin');
    assert.equal(restrictedSuperadminSessionBody.user.accessMode, 'custom');
    assert.equal(restrictedSuperadminSessionBody.user.permissionsAssignedBy?.email, 'root@example.com');
    assert.equal(restrictedSuperadminSessionBody.user.permissions.jobs.view, true);
    assert.equal(restrictedSuperadminSessionBody.user.permissions.directory.view, false);
    assert.equal(restrictedSuperadminSessionBody.user.permissions.users.view, false);

    const restrictedUsers = await fetch(`${baseUrl}/admin/users`, {
      headers: { cookie: restrictedSuperadminCookie },
    });
    assert.equal(restrictedUsers.status, 403);
    const restrictedCompanyEdit = await fetch(`${baseUrl}/auth/profile/company`, {
      method: 'PATCH',
      headers: { cookie: restrictedSuperadminCookie, 'content-type': 'application/json' },
      body: JSON.stringify({
        companyName: 'Unauthorized Update',
        phone: '',
        email: '',
        gstin: '',
      }),
    });
    assert.equal(restrictedCompanyEdit.status, 403);
    const restrictedDirectory = await fetch(`${baseUrl}/admin/registrations`, {
      headers: { cookie: restrictedSuperadminCookie },
    });
    assert.equal(restrictedDirectory.status, 403);

    const scopedManagerCookie = await login('scoped-manager@example.com', scopedManagerPassword);
    const broaderRoleGrant = await fetch(`${baseUrl}/admin/users`, {
      method: 'POST',
      headers: { cookie: scopedManagerCookie, 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Broader Account',
        email: 'broader@example.com',
        password: 'Broader-account-password-123',
        role: 'viewer',
      }),
    });
    assert.equal(broaderRoleGrant.status, 400);

    const broaderUserGrantPermissions = structuredClone(scopedManagerPermissions);
    broaderUserGrantPermissions.directory.view = true;
    const broaderUserGrant = await fetch(
      `${baseUrl}/admin/users/${restrictedSuperadmin.id}/permissions`,
      {
        method: 'PUT',
        headers: { cookie: scopedManagerCookie, 'content-type': 'application/json' },
        body: JSON.stringify({ permissions: broaderUserGrantPermissions }),
      },
    );
    assert.equal(broaderUserGrant.status, 400);

    const demoCookie = await login('demo-admin@localhost.test', demoPassword);
    const demoUsers = await fetch(`${baseUrl}/admin/users`, {
      headers: { cookie: demoCookie },
    });
    assert.equal(demoUsers.status, 200);

    const allowed = await fetch(`${baseUrl}/admin/users`, {
      headers: { cookie: rootCookie },
    });
    assert.equal(allowed.status, 200);
    const listedUsers = (await allowed.json() as { users: Array<{ userCode: string }> }).users;
    assert.ok(listedUsers.every((user) => /^\d{3}-[A-Z]{2}_$/.test(user.userCode)));
    assert.equal(new Set(listedUsers.map((user) => user.userCode)).size, listedUsers.length);

    const viewer = (await store.getUserByEmail('viewer@example.com'))!;
    const launchResponse = await fetch(`${baseUrl}/admin/users/${viewer.id}/impersonation`, {
      method: 'POST',
      headers: { cookie: rootCookie, 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.equal(launchResponse.status, 200);
    const launch = await launchResponse.json() as { launchToken: string; expiresAt: number };
    assert.match(launch.launchToken, /^[A-Za-z0-9_-]{40,60}$/);
    assert.ok(launch.expiresAt > Date.now());
    assert.ok(launch.expiresAt <= Date.now() + 60_000);

    const exchange = await fetch(`${baseUrl}/auth/impersonation/exchange`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: launch.launchToken }),
    });
    assert.equal(exchange.status, 200);
    const impersonation = await exchange.json() as {
      sessionToken: string;
      user: { id: string; email: string; role: string };
      expiresAt: number;
      impersonation: { actorId: string; actorEmail: string };
    };
    assert.equal(impersonation.user.id, viewer.id);
    assert.equal(impersonation.user.role, 'viewer');
    assert.equal(impersonation.impersonation.actorEmail, 'root@example.com');
    assert.ok(impersonation.expiresAt > Date.now());
    assert.ok(impersonation.expiresAt <= Date.now() + 30 * 60 * 1000 + 1000);

    const bearerHeaders = {
      cookie: rootCookie,
      authorization: `Bearer ${impersonation.sessionToken}`,
    };
    const impersonatedSession = await fetch(`${baseUrl}/auth/me`, { headers: bearerHeaders });
    const impersonatedSessionBody = await impersonatedSession.json() as {
      user: { id: string; email: string } | null;
      impersonation: { actorId: string } | null;
    };
    assert.equal(impersonatedSessionBody.user?.id, viewer.id);
    assert.equal(impersonatedSessionBody.impersonation?.actorId, root.id);

    const impersonatedAdminRequest = await fetch(`${baseUrl}/admin/users`, {
      headers: bearerHeaders,
    });
    assert.equal(impersonatedAdminRequest.status, 403);
    const impersonatedDeniedAudit = (await store.listAuditEvents())
      .find((event) => event.action === 'auth.permission_denied' &&
        event.targetId === 'users' && event.details.impersonatedById === root.id);
    assert.equal(impersonatedDeniedAudit?.actorId, viewer.id);
    const blockedPasswordChange = await fetch(`${baseUrl}/auth/profile/password`, {
      method: 'POST',
      headers: { ...bearerHeaders, 'content-type': 'application/json' },
      body: JSON.stringify({
        currentPassword: 'Viewer-password-123',
        newPassword: 'Viewer-new-password-123',
      }),
    });
    assert.equal(blockedPasswordChange.status, 403);

    const reusedLaunch = await fetch(`${baseUrl}/auth/impersonation/exchange`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: launch.launchToken }),
    });
    assert.equal(reusedLaunch.status, 401);

    const impersonatedLogout = await fetch(`${baseUrl}/auth/logout`, {
      method: 'POST',
      headers: bearerHeaders,
    });
    assert.equal(impersonatedLogout.status, 204);
    assert.equal(impersonatedLogout.headers.get('set-cookie'), null);
    const endedImpersonation = await fetch(`${baseUrl}/auth/me`, { headers: bearerHeaders });
    assert.equal((await endedImpersonation.json() as { user: unknown }).user, null);
    const originalAdminSession = await fetch(`${baseUrl}/auth/me`, {
      headers: { cookie: rootCookie },
    });
    assert.equal(
      (await originalAdminSession.json() as { user: { id: string } }).user.id,
      root.id,
    );
    const startAudit = (await store.listAuditEvents())
      .find((event) => event.action === 'auth.impersonation_started');
    assert.equal(startAudit?.actorId, root.id);
    assert.equal(startAudit?.targetId, viewer.id);

    const selfLaunch = await fetch(`${baseUrl}/admin/users/${root.id}/impersonation`, {
      method: 'POST',
      headers: { cookie: rootCookie, 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.equal(selfLaunch.status, 403);

    const registrations = await fetch(`${baseUrl}/admin/registrations`, {
      headers: { cookie: rootCookie },
    });
    assert.equal(registrations.status, 200);
    assert.equal((await registrations.json() as { registrations: Array<{ registrationId: string }> })
      .registrations[0].registrationId, 'EN-PARTNER-10001');
    const missingProfile = await fetch(`${baseUrl}/admin/registrations/energy-hub%3A999`, {
      headers: { cookie: rootCookie },
    });
    assert.equal(missingProfile.status, 404);

    const viewerCookie = await login('viewer@example.com', 'Viewer-password-123');
    const denied = await fetch(`${baseUrl}/admin/users`, {
      headers: { cookie: viewerCookie },
    });
    assert.equal(denied.status, 403);
    assert.ok((await store.listAuditEvents()).some((event) => event.action === 'auth.permission_denied'));

    const permissions = await store.getPermissions();
    permissions.viewer.directory.view = false;
    const directoryPermissionUpdate = await fetch(`${baseUrl}/access/roles/viewer`, {
      method: 'PUT',
      headers: { cookie: rootCookie, 'content-type': 'application/json' },
      body: JSON.stringify({ permissions: permissions.viewer }),
    });
    assert.equal(directoryPermissionUpdate.status, 200);
    const deniedDirectory = await fetch(`${baseUrl}/admin/registrations`, {
      headers: { cookie: viewerCookie },
    });
    assert.equal(deniedDirectory.status, 403);
    const deniedProfile = await fetch(`${baseUrl}/admin/registrations/energy-hub%3A1`, {
      headers: { cookie: viewerCookie },
    });
    assert.equal(deniedProfile.status, 403);

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
    const newUserCode = createdBody.user['userCode'];
    assert.ok(typeof newUserCode === 'string' && /^\d{3}-[A-Z]{2}_$/.test(newUserCode));
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
    const newUserAvatar = await fetch(`${baseUrl}/auth/profile/avatar`, {
      method: 'PUT',
      headers: { cookie: newUserCookie, 'content-type': 'image/png' },
      body: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    });
    assert.equal(newUserAvatar.status, 200);
    const avatarFile = (await store.getUserById(newUserId as string))?.avatarFile;
    assert.equal(typeof avatarFile, 'string');
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
      user: {
        accessMode: string;
        permissionsAssignedBy: { name: string; email: string } | null;
        permissions: { jobs: { edit: boolean } };
      };
    };
    assert.equal(inheritedSessionBody.user.accessMode, 'role');
    assert.equal(inheritedSessionBody.user.permissionsAssignedBy, null);
    assert.equal(inheritedSessionBody.user.permissions.jobs.edit, false);

    const selfDelete = await fetch(`${baseUrl}/admin/users/${root.id}`, {
      method: 'DELETE',
      headers: { cookie: rootCookie },
    });
    assert.equal(selfDelete.status, 400);
    const protectedSuperadminDelete = await fetch(`${baseUrl}/admin/users/${scopedManager.id}`, {
      method: 'DELETE',
      headers: { cookie: rootCookie },
    });
    assert.equal(protectedSuperadminDelete.status, 400);

    const deletedUserId = newUserId as string;
    const deleteUser = await fetch(`${baseUrl}/admin/users/${deletedUserId}`, {
      method: 'DELETE',
      headers: { cookie: rootCookie },
    });
    assert.equal(deleteUser.status, 204);
    assert.equal(await store.getUserById(deletedUserId), undefined);
    await assert.rejects(
      readFile(join(directory, 'access-control.json.avatars', avatarFile!)),
      { code: 'ENOENT' },
    );
    const deletedUserSession = await fetch(`${baseUrl}/auth/me`, {
      headers: { cookie: newUserCookie },
    });
    assert.deepEqual(await deletedUserSession.json(), { user: null, expiresAt: null });

    const wrongPasswordChange = await fetch(`${baseUrl}/auth/profile/password`, {
      method: 'POST',
      headers: { cookie: rootCookie, 'content-type': 'application/json' },
      body: JSON.stringify({
        currentPassword: 'Wrong-current-password',
        newPassword: 'New-root-password-123',
      }),
    });
    assert.equal(wrongPasswordChange.status, 400);
    const passwordChange = await fetch(`${baseUrl}/auth/profile/password`, {
      method: 'POST',
      headers: { cookie: rootCookie, 'content-type': 'application/json' },
      body: JSON.stringify({
        currentPassword: superadminPassword,
        newPassword: 'New-root-password-123',
      }),
    });
    assert.equal(passwordChange.status, 204);
    const currentSessionAfterPasswordChange = await fetch(`${baseUrl}/auth/me`, {
      headers: { cookie: rootCookie },
    });
    assert.notEqual((await currentSessionAfterPasswordChange.json() as { user: unknown }).user, null);
    const revokedSessionAfterPasswordChange = await fetch(`${baseUrl}/auth/me`, {
      headers: { cookie: revokedRootCookie },
    });
    assert.equal((await revokedSessionAfterPasswordChange.json() as { user: unknown }).user, null);
    const oldPasswordLogin = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'root@example.com', password: superadminPassword }),
    });
    assert.equal(oldPasswordLogin.status, 401);
    const newPasswordLogin = await login('root@example.com', 'New-root-password-123');
    assert.ok(newPasswordLogin.startsWith('eh_session='));

    const auditActions = (await store.listAuditEvents()).map((event) => event.action);
    assert.ok(auditActions.includes('permissions.updated'));
    assert.ok(auditActions.includes('user.created'));
    assert.ok(auditActions.includes('user.deleted'));
    assert.ok(auditActions.includes('user.permissions_updated'));
    assert.ok(auditActions.includes('user.profile_updated'));
    assert.ok(auditActions.includes('user.avatar_updated'));
    assert.ok(auditActions.includes('user.avatar_removed'));
    assert.ok(auditActions.includes('company.profile_updated'));
    assert.ok(auditActions.includes('auth.password_changed'));
    assert.ok(auditActions.includes('auth.password_change_failed'));
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
