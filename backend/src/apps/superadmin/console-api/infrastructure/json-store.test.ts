import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { JsonStore } from './json-store.js';
import { hashPassword } from '../services/passwords.js';

test('bootstrap state and audit changes persist across store instances', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'energy-hub-store-'));
  const file = join(directory, 'access-control.json');
  const store = new JsonStore(file);

  try {
    await store.initialize({
      email: 'root@example.com',
      name: 'Root User',
      passwordSalt: 'salt',
      passwordHash: 'hash',
    });
    const actor = (await store.getUserByEmail('root@example.com'))!;
    await store.recordAudit(actor, 'test.event', 'test', 'record', { ok: true });

    const reopened = new JsonStore(file);
    await reopened.initialize({
      email: 'ignored@example.com',
      name: 'Ignored User',
      passwordSalt: 'ignored',
      passwordHash: 'ignored',
    });

    assert.equal((await reopened.listUsers()).length, 1);
    assert.equal((await reopened.getUserByEmail('ignored@example.com')), undefined);
    assert.equal((await reopened.listAuditEvents())[0]?.action, 'test.event');
    assert.match(await readFile(file, 'utf8'), /"version": 1/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('local demo superadmin credentials can be rotated without storing plaintext', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'energy-hub-demo-'));
  const file = join(directory, 'access-control.json');
  const store = new JsonStore(file);
  const firstPassword = hashPassword('First-local-demo-password');
  const nextPassword = hashPassword('Next-local-demo-password');

  try {
    await store.initialize({
      email: 'root@example.com',
      name: 'Root User',
      passwordSalt: 'root-salt',
      passwordHash: 'root-hash',
    });
    await store.ensureLocalDemoSuperadmin({
      name: 'Local Demo Superadmin',
      email: 'demo-admin@localhost.test',
      passwordSalt: firstPassword.salt,
      passwordHash: firstPassword.hash,
    });
    const firstUser = await store.getUserByEmail('demo-admin@localhost.test');
    assert.equal(firstUser?.role, 'superadmin');
    assert.equal(firstUser?.disabled, false);

    await store.ensureLocalDemoSuperadmin({
      name: 'Local Demo Superadmin',
      email: 'demo-admin@localhost.test',
      passwordSalt: nextPassword.salt,
      passwordHash: nextPassword.hash,
    });
    const nextUser = await store.getUserByEmail('demo-admin@localhost.test');
    assert.equal(nextUser?.id, firstUser?.id);
    assert.equal(nextUser?.passwordHash, nextPassword.hash);
    assert.equal((await store.listAuditEvents()).filter((event) => event.action.startsWith('system.local_demo_')).length, 2);

    const persistedState = await readFile(file, 'utf8');
    assert.equal(persistedState.includes('Next-local-demo-password'), false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('local demo account can move to a configured email without retaining the old login', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'energy-hub-demo-migration-'));
  const file = join(directory, 'access-control.json');
  const store = new JsonStore(file);
  const credentials = hashPassword('test@123');

  try {
    await store.initialize({
      email: 'root@example.com',
      name: 'Root User',
      passwordSalt: 'root-salt',
      passwordHash: 'root-hash',
    });
    await store.ensureLocalDemoSuperadmin({
      name: 'Local Demo Superadmin',
      email: 'demo-admin@localhost.test',
      passwordSalt: credentials.salt,
      passwordHash: credentials.hash,
    });
    await store.ensureLocalDemoSuperadmin({
      name: 'Local Demo Superadmin',
      email: 'test123@gmail.com',
      passwordSalt: credentials.salt,
      passwordHash: credentials.hash,
    });

    assert.equal(await store.getUserByEmail('demo-admin@localhost.test'), undefined);
    assert.equal((await store.getUserByEmail('test123@gmail.com'))?.role, 'superadmin');
    assert.equal((await store.listUsers()).length, 2);
    assert.equal((await readFile(file, 'utf8')).includes('test@123'), false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
