const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { env } = require('../../config/energy_service/env');
const { pool } = require('../../config/energy_service/db');
const AppError = require('../../utils/energy_service/AppError');
const { randomToken, sha256, normalizeIp } = require('../../utils/energy_service/crypto');
const sessionModel = require('../../models/energy_service/session.model');

function signAccessToken({ userId, role, sessionId }) {
  return jwt.sign(
    { sub: userId, sid: sessionId, role, typ: 'access' },
    env.accessTokenSecret,
    {
      algorithm: 'HS256',
      expiresIn: env.accessTokenTtlSeconds,
      issuer: env.jwtIssuer,
      audience: env.jwtAudience,
    },
  );
}

function verifyAccessToken(token) {
  const payload = jwt.verify(token, env.accessTokenSecret, {
    algorithms: ['HS256'],
    issuer: env.jwtIssuer,
    audience: env.jwtAudience,
  });
  if (!payload || payload.typ !== 'access' || !payload.sub || !payload.sid) {
    throw new AppError('Unauthorized.', 401, 'UNAUTHORIZED');
  }
  return payload;
}

function refreshExpiry() {
  return new Date(Date.now() + env.refreshTokenTtlDays * 24 * 60 * 60 * 1000);
}

function invalidSession() {
  return new AppError('Invalid session.', 401, 'INVALID_SESSION');
}

async function createSession({ userId, ip, userAgent, deviceId, deviceName }, client) {
  const refreshToken = randomToken();
  const session = {
    id: crypto.randomUUID(),
    userId,
    tokenHash: sha256(refreshToken),
    expiresAt: refreshExpiry(),
    userAgent: userAgent || null,
    ip: ip || null,
    deviceId: deviceId || null,
    deviceName: deviceName || null,
  };
  await sessionModel.insert(session, client);
  return { sessionId: session.id, userId, refreshToken };
}

async function rotateRefreshToken(rawToken, meta) {
  const tokenHash = sha256(rawToken);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const session = await sessionModel.findByHashForUpdate(tokenHash, client);
    if (!session) {
      await client.query('COMMIT');
      throw invalidSession();
    }

    if (session.revoked_at) {
      // A token superseded by rotation (revoke_reason = 'rotated') means an
      // already-used refresh token was presented — revoke the whole family.
      // Logout / password-change revocations are dead tokens, not reuse:
      // they only get 401 so one stale device cannot sign out every other.
      if (session.revoke_reason === 'rotated') {
        await sessionModel.revokeAllForUser(session.user_id, client, 'reuse_detected');
      }
      await client.query('COMMIT');
      throw invalidSession();
    }

    if (new Date(session.expires_at).getTime() <= Date.now()) {
      await sessionModel.markRevoked(session.id, client, 'expired');
      await client.query('COMMIT');
      throw invalidSession();
    }

    const refreshToken = randomToken();
    const newId = crypto.randomUUID();
    await sessionModel.insert({
      id: newId,
      userId: session.user_id,
      tokenHash: sha256(refreshToken),
      expiresAt: refreshExpiry(),
      userAgent: meta.userAgent,
      ip: meta.ip,
      deviceId: meta.deviceId,
      deviceName: meta.deviceName,
    }, client);
    await sessionModel.markRevoked(session.id, client, 'rotated');
    await client.query('COMMIT');
    return { sessionId: newId, userId: session.user_id, refreshToken };
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (_rollbackError) {
      // Expected auth failures commit before throwing, so rollback can be a no-op.
    }
    throw err;
  } finally {
    client.release();
  }
}

async function revokeRawToken(rawToken) {
  await sessionModel.revokeByHash(sha256(rawToken));
}

function requestMeta(req) {
  const userAgent = req.get('user-agent') || '';
  const body = req.body || {};
  return {
    ip: normalizeIp(req.ip),
    userAgent: userAgent ? userAgent.slice(0, 255) : null,
    deviceId: body.deviceId ? String(body.deviceId).slice(0, 128) : null,
    deviceName: body.deviceName ? String(body.deviceName).slice(0, 120) : null,
  };
}

module.exports = {
  signAccessToken,
  verifyAccessToken,
  createSession,
  rotateRefreshToken,
  revokeRawToken,
  requestMeta,
  hashToken: sha256,
  generateOpaqueToken: randomToken,
};
