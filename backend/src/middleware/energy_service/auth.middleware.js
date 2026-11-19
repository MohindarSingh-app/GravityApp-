const AppError = require('../../utils/energy_service/AppError');
const { sha256 } = require('../../utils/energy_service/crypto');
const tokenService = require('../../services/energy_service/token.service');
const sessionModel = require('../../models/energy_service/session.model');
const userModel = require('../../models/energy_service/user.model');
const apiKeyModel = require('../../models/energy_service/apiKey.model');

async function attachUser(req, user, extras) {
  if (user.status && user.status !== 'active') {
    throw new AppError('This account is not active.', 403, 'ACCOUNT_INACTIVE');
  }
  if (user.role_status && user.role_status !== 'active') {
    throw new AppError('This account is not active.', 403, 'ACCOUNT_INACTIVE');
  }
  req.user = user;
  req.auth = {
    userId: user.id,
    role: user.role,
    roleId: user.role_id,
    companyId: user.company_id || null,
    sessionId: extras.sessionId || null,
    emailVerified: Boolean(user.email_verified),
    phoneVerified: Boolean(user.phone_verified),
    authType: extras.authType,
  };
}

async function authenticateApiKey(req, rawKey) {
  const record = await apiKeyModel.findByHash(sha256(rawKey));
  if (!record || record.revoked_at) {
    throw new AppError('Unauthorized.', 401, 'UNAUTHORIZED');
  }
  if (record.expires_at && new Date(record.expires_at).getTime() <= Date.now()) {
    throw new AppError('Unauthorized.', 401, 'UNAUTHORIZED');
  }
  const user = await userModel.findById(record.user_id);
  if (!user) {
    throw new AppError('Unauthorized.', 401, 'UNAUTHORIZED');
  }
  if (record.company_id && record.company_id !== user.company_id) {
    throw new AppError('Unauthorized.', 401, 'UNAUTHORIZED');
  }
  await apiKeyModel.touchLastUsed(record.id);
  await attachUser(req, user, { authType: 'api_key', sessionId: null });
}

async function requireAuth(req, _res, next) {
  try {
    const header = req.headers.authorization || '';
    const apiKeyHeader = req.get('x-api-key');
    if (apiKeyHeader) {
      await authenticateApiKey(req, apiKeyHeader);
      return next();
    }

    const parts = header.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer' || !parts[1]) {
      throw new AppError('Unauthorized.', 401, 'UNAUTHORIZED');
    }

    if (parts[1].startsWith('zsa_')) {
      await authenticateApiKey(req, parts[1]);
      return next();
    }

    let payload;
    try {
      payload = tokenService.verifyAccessToken(parts[1]);
    } catch (err) {
      if (err instanceof AppError) return next(err);
      return next(new AppError('Unauthorized.', 401, 'UNAUTHORIZED'));
    }
    const session = await sessionModel.findById(payload.sid);
    const sessionExpired = !session || new Date(session.expires_at).getTime() <= Date.now();
    if (!session || session.revoked_at || sessionExpired || session.user_id !== payload.sub) {
      throw new AppError('Unauthorized.', 401, 'UNAUTHORIZED');
    }

    const user = await userModel.findById(payload.sub);
    if (!user) {
      throw new AppError('Unauthorized.', 401, 'UNAUTHORIZED');
    }

    await sessionModel.touchLastUsed(session.id);
    await attachUser(req, user, { authType: 'session', sessionId: session.id });
    return next();
  } catch (err) {
    if (err instanceof AppError) return next(err);
    return next(err);
  }
}

function optionalAuth(req, res, next) {
  if (!req.headers.authorization && !req.get('x-api-key')) return next();
  return requireAuth(req, res, next);
}

function requireSession(req, _res, next) {
  if (!req.auth || !req.auth.sessionId) {
    return next(new AppError('A user session is required.', 401, 'UNAUTHORIZED'));
  }
  return next();
}

module.exports = { requireAuth, optionalAuth, requireSession };
