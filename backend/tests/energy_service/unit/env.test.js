const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const backendRoot = path.resolve(__dirname, '../../..');
const baseEnvironment = {
  ...process.env,
  NODE_ENV: 'production',
  ACCESS_TOKEN_SECRET: 'audit-access-token-secret-0123456789',
  OTP_HASH_SECRET: 'audit-otp-hash-secret-0123456789',
  DATABASE_URL: 'postgresql://audit:audit@127.0.0.1:5432/service_audit',
  SMTP_HOST: 'smtp.example.test',
  SMS_PROVIDER: 'twilio',
  TWILIO_ACCOUNT_SID: `AC${'1'.repeat(32)}`,
  TWILIO_AUTH_TOKEN: 'audit-twilio-auth-token',
  TWILIO_FROM_NUMBER: '+14155552671',
  ENABLE_DEV_MAILBOX: 'false',
  DEV_FIXED_OTP: '',
  DEV_LOGIN_PHONE: '',
};

function loadProductionConfig(overrides = {}) {
  return spawnSync(
    process.execPath,
    ['-e', "const { env } = require('./src/config/energy_service/env'); console.log(env.smsProvider);"],
    {
      cwd: backendRoot,
      env: { ...baseEnvironment, ...overrides },
      encoding: 'utf8',
    },
  );
}

test('production configuration rejects a missing SMS provider', () => {
  const result = loadProductionConfig({ SMS_PROVIDER: '' });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /SMS_PROVIDER=twilio is required in production/);
});

test('production configuration rejects a missing or reused OTP hash secret', () => {
  const missing = loadProductionConfig({ OTP_HASH_SECRET: '' });
  const reused = loadProductionConfig({
    OTP_HASH_SECRET: baseEnvironment.ACCESS_TOKEN_SECRET,
  });

  assert.notEqual(missing.status, 0);
  assert.match(missing.stderr, /OTP_HASH_SECRET must be unique and set in production/);
  assert.notEqual(reused.status, 0);
  assert.match(reused.stderr, /OTP_HASH_SECRET must be unique and set in production/);
});

test('production configuration accepts a configured Twilio provider', () => {
  const result = loadProductionConfig({
    SMS_PROVIDER: 'twilio',
    TWILIO_ACCOUNT_SID: `AC${'1'.repeat(32)}`,
    TWILIO_AUTH_TOKEN: 'audit-twilio-auth-token',
    TWILIO_FROM_NUMBER: '+14155552671',
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /twilio/);
});
