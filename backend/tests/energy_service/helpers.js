const http = require('http');
const { randomInt } = require('node:crypto');
const { gstinChecksumChar } = require('../../src/utils/energy_service/gst');

function uniquePhone() {
  const n = Math.floor(100000000 + Math.random() * 899999999);
  return `9${String(n).slice(0, 9)}`;
}

function uniqueGstin() {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const panPrefix = Array.from({ length: 5 }, () => letters[randomInt(letters.length)]).join('');
  const digits = String(randomInt(10000)).padStart(4, '0');
  const base = `27${panPrefix}${digits}F1Z`;
  return `${base}${gstinChecksumChar(base)}`;
}

function uniqueEmail() {
  return `user_${Date.now()}_${Math.floor(Math.random() * 1000)}@example.com`;
}

function assertNoSecrets(text) {
  const body = text || '';
  if (body.includes('password_hash') || body.includes('$argon2')) {
    throw new Error('response exposed a password hash');
  }
  if (/"otp"\s*:\s*"\d{6}"/.test(body) && !body.includes('otpCodeSchema')) {
    throw new Error('response exposed an OTP');
  }
  if (body.includes('key_hash') || body.includes('ACCESS_TOKEN_SECRET')) {
    throw new Error('response exposed a secret');
  }
  if (/"stack"\s*:/.test(body)) {
    throw new Error('response exposed a stack trace');
  }
}

async function listen(app) {
  const server = http.createServer(app);
  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address();
  return {
    server,
    base: `http://127.0.0.1:${port}`,
    async close() {
      await new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    },
  };
}

async function api(base, path, { method = 'GET', body, token, apiKey } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  if (apiKey) headers['X-API-Key'] = apiKey;
  const response = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  assertNoSecrets(text);
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch (_err) {
      payload = null;
    }
  }
  return { status: response.status, payload, text, headers: response.headers };
}

module.exports = {
  uniquePhone,
  uniqueGstin,
  uniqueEmail,
  listen,
  api,
  assertNoSecrets,
};
