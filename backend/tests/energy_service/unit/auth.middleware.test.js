const { test } = require('node:test');
const assert = require('node:assert/strict');
const tokenService = require('../../../src/services/energy_service/token.service');
const sessionModel = require('../../../src/models/energy_service/session.model');
const AppError = require('../../../src/utils/energy_service/AppError');
const { requireAuth } = require('../../../src/middleware/energy_service/auth.middleware');

function createRequest() {
  return {
    headers: { authorization: 'Bearer valid-token' },
    get: () => undefined,
  };
}

test('authentication forwards database failures instead of misreporting them as unauthorized', async () => {
  const originalVerify = tokenService.verifyAccessToken;
  const originalFindById = sessionModel.findById;
  const databaseError = new Error('database connection timed out');
  tokenService.verifyAccessToken = () => ({ sid: 'session-1', sub: 'user-1' });
  sessionModel.findById = async () => { throw databaseError; };

  try {
    const forwarded = await new Promise((resolve) => {
      requireAuth(createRequest(), {}, resolve);
    });
    assert.equal(forwarded, databaseError);
    assert.notEqual(forwarded.code, 'UNAUTHORIZED');
  } finally {
    tokenService.verifyAccessToken = originalVerify;
    sessionModel.findById = originalFindById;
  }
});

test('authentication continues to report invalid access tokens as unauthorized', async () => {
  const originalVerify = tokenService.verifyAccessToken;
  const invalidTokenError = new Error('jwt expired');
  tokenService.verifyAccessToken = () => { throw invalidTokenError; };

  try {
    const forwarded = await new Promise((resolve) => {
      requireAuth(createRequest(), {}, resolve);
    });
    assert.ok(forwarded instanceof AppError);
    assert.equal(forwarded.code, 'UNAUTHORIZED');
  } finally {
    tokenService.verifyAccessToken = originalVerify;
  }
});
