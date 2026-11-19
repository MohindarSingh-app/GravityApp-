const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { buildLimiter } = require('../../../src/middleware/energy_service/rateLimit.middleware');
const { listen, api } = require('../helpers');

test('HTTP rate limiter returns the standard error envelope', async () => {
  const app = express();
  app.use(buildLimiter({ windowMs: 60000, max: 1 }));
  app.post('/ping', (_req, res) => res.json({ success: true, data: {} }));
  const harness = await listen(app);
  try {
    const first = await api(harness.base, '/ping', { method: 'POST', body: {} });
    assert.equal(first.status, 200);
    const second = await api(harness.base, '/ping', { method: 'POST', body: {} });
    assert.equal(second.status, 429);
    assert.equal(second.payload.success, false);
    assert.equal(second.payload.error.code, 'RATE_LIMITED');
  } finally {
    await harness.close();
  }
});
