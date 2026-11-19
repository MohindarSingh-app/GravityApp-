import { Router } from 'express5';
import { JsonStore } from './infrastructure/json-store.js';
import { AccessControlService } from './services/access-control.js';
import { AuthenticationService } from './services/authentication.js';
import { hashPassword } from './services/passwords.js';
import { SessionManager } from './services/sessions.js';
import { createApiRouter } from './http/routes.js';

export async function createSuperadminRouter(options: {
  bootstrap: { email: string; name: string; password: string };
  dataFile: string;
}): Promise<ReturnType<typeof Router>> {
  if (process.env.ENABLE_LOCAL_DEMO_LOGIN === 'true') {
    throw new Error('Disable ENABLE_LOCAL_DEMO_LOGIN when using the shared backend.');
  }

  const { bootstrap, dataFile } = options;
  const credentials = bootstrap.password
    ? hashPassword(bootstrap.password)
    : { salt: '', hash: '' };
  const store = new JsonStore(dataFile);
  await store.initialize({
    email: bootstrap.email,
    name: bootstrap.name,
    passwordSalt: credentials.salt,
    passwordHash: credentials.hash,
  });

  return createApiRouter({
    store,
    access: new AccessControlService(store),
    authentication: new AuthenticationService(store),
    sessions: new SessionManager(),
    secureCookies: process.env.NODE_ENV === 'production',
    localDemoCredentials: null,
  });
}
