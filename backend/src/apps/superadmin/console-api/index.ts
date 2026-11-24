import { Router } from 'express5';
import { JsonStore } from './infrastructure/json-store.js';
import { PostgresStore } from './infrastructure/postgres-store.js';
import { AccessControlService } from './services/access-control.js';
import { AuthenticationService } from './services/authentication.js';
import { hashPassword } from './services/passwords.js';
import { SessionManager } from './services/sessions.js';
import { createApiRouter } from './http/routes.js';
import { createRequire } from 'node:module';
import type { PlatformRegistration, PlatformRegistrationDetails } from './domain/models.js';

const require = createRequire(import.meta.url);
const { createPlatformDirectory } = require('./services/platform-directory.js') as {
  createPlatformDirectory: () => {
    listRegistrations(): Promise<PlatformRegistration[]>;
    getRegistrationDetails(id: string): Promise<PlatformRegistrationDetails | null>;
  };
};
const { createOperationsDirectory } = require('./services/operations-directory.js') as {
  createOperationsDirectory: () => {
    getData(domain: string): Promise<unknown>;
  };
};

export async function createSuperadminRouter(options: {
  bootstrap: { email: string; name: string; password: string };
  dataFile: string;
  storage?: 'database' | 'json';
}): Promise<ReturnType<typeof Router>> {
  const { bootstrap, dataFile, storage = 'database' } = options;
  const enableLocalDemoLogin = process.env.ENABLE_LOCAL_DEMO_LOGIN === 'true';
  const localDemoEmail = process.env.LOCAL_DEMO_EMAIL?.trim().toLowerCase() ?? '';
  const localDemoPassword = process.env.LOCAL_DEMO_PASSWORD ?? '';
  if (enableLocalDemoLogin) {
    if (process.env.NODE_ENV !== 'development') {
      throw new Error('ENABLE_LOCAL_DEMO_LOGIN is only allowed in development.');
    }
    if (!localDemoEmail || !localDemoPassword) {
      throw new Error('Set LOCAL_DEMO_EMAIL and LOCAL_DEMO_PASSWORD when enabling local demo login.');
    }
    if (localDemoEmail === bootstrap.email.trim().toLowerCase()) {
      throw new Error('Local demo credentials must not replace the bootstrap superadmin account.');
    }
  }

  const credentials = bootstrap.password
    ? hashPassword(bootstrap.password)
    : { salt: '', hash: '' };
  const store = storage === 'database'
    ? new PostgresStore(dataFile)
    : new JsonStore(dataFile);
  await store.initialize({
    email: bootstrap.email,
    name: bootstrap.name,
    passwordSalt: credentials.salt,
    passwordHash: credentials.hash,
  });

  const localDemoCredentials = enableLocalDemoLogin
    ? { email: localDemoEmail, password: localDemoPassword }
    : null;
  if (localDemoCredentials) {
    const demoPassword = hashPassword(localDemoCredentials.password);
    await store.ensureLocalDemoSuperadmin({
      name: 'Local Demo Superadmin',
      email: localDemoCredentials.email,
      passwordSalt: demoPassword.salt,
      passwordHash: demoPassword.hash,
    });
  }

  return createApiRouter({
    store,
    access: new AccessControlService(store),
    authentication: new AuthenticationService(store),
    sessions: new SessionManager(),
    secureCookies: process.env.NODE_ENV === 'production',
    localDemoCredentials,
    platformDirectory: createPlatformDirectory(),
    operationsDirectory: createOperationsDirectory(),
  });
}
