const assert = require('node:assert/strict');
const express = require('express');
const { mkdtemp, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { once } = require('node:events');
const test = require('node:test');
const { createSuperadminConsole } = require('../src/apps/superadmin/console');

test('Superadmin console shares the main API process without shadowing mobile auth', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'gravityhub-console-'));
  const superadmin = createSuperadminConsole({
    dataFile: path.join(directory, 'access-control.json'),
  });
  const previousEnvironment = {
    nodeEnv: process.env.NODE_ENV,
    enableDemo: process.env.ENABLE_LOCAL_DEMO_LOGIN,
    demoEmail: process.env.LOCAL_DEMO_EMAIL,
    demoPassword: process.env.LOCAL_DEMO_PASSWORD,
  };
  process.env.NODE_ENV = 'development';
  process.env.ENABLE_LOCAL_DEMO_LOGIN = 'true';
  process.env.LOCAL_DEMO_EMAIL = 'demo-admin@localhost.test';
  process.env.LOCAL_DEMO_PASSWORD = 'admin@123';
  try {
    await superadmin.initialize({
      email: 'root@example.com',
      name: 'Root User',
      password: 'Gravityhub-local-password-123',
    });
  } finally {
    for (const [key, value] of Object.entries({
      NODE_ENV: previousEnvironment.nodeEnv,
      ENABLE_LOCAL_DEMO_LOGIN: previousEnvironment.enableDemo,
      LOCAL_DEMO_EMAIL: previousEnvironment.demoEmail,
      LOCAL_DEMO_PASSWORD: previousEnvironment.demoPassword,
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }

  const app = express();
  app.use(express.json());
  app.post('/api/auth/login', (_request, response) => {
    response.json({ module: 'mobile-service' });
  });
  app.use('/api/superadmin/console', superadmin.router);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const mobileLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.deepEqual(await mobileLogin.json(), { module: 'mobile-service' });

    const demoInfo = await fetch(`${baseUrl}/api/superadmin/console/auth/local-demo`);
    assert.deepEqual(await demoInfo.json(), {
      enabled: true,
      credentials: {
        email: 'demo-admin@localhost.test',
        password: 'admin@123',
      },
    });

    const demoLogin = await fetch(`${baseUrl}/api/superadmin/console/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: 'demo-admin@localhost.test',
        password: 'admin@123',
      }),
    });
    assert.equal(demoLogin.status, 200);
    assert.equal((await demoLogin.json()).user.role, 'superadmin');

    const login = await fetch(`${baseUrl}/api/superadmin/console/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: 'root@example.com',
        password: 'Gravityhub-local-password-123',
      }),
    });
    assert.equal(login.status, 200);
    const loginResult = await login.json();
    assert.ok(typeof loginResult.sessionToken === 'string');
    const token = loginResult.sessionToken;

    const session = await fetch(`${baseUrl}/api/superadmin/console/auth/me`, {
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(session.status, 200);
    assert.equal((await session.json()).user.email, 'root@example.com');

    const users = await fetch(`${baseUrl}/api/superadmin/console/admin/users`, {
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(users.status, 200);
    assert.equal((await users.json()).users.length, 2);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
    await rm(directory, { recursive: true, force: true });
  }
});
