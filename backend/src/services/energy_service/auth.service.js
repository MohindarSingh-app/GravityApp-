const { env } = require('../../config/energy_service/env');
const { pool } = require('../../config/energy_service/db');
const AppError = require('../../utils/energy_service/AppError');
const { toPublicUser } = require('../../utils/energy_service/publicUser');
const { withTransaction } = require('../../utils/energy_service/transaction');
const { deriveOnboardingStatus, onboardingFlags } = require('../../constants/energy_service/onboarding');
const { ROLES } = require('../../constants/energy_service/roles');
const userModel = require('../../models/energy_service/user.model');
const sessionModel = require('../../models/energy_service/session.model');
const otpModel = require('../../models/energy_service/otp.model');
const siteModel = require('../../models/energy_service/site.model');
const companyModel = require('../../models/energy_service/company.model');
const roleModel = require('../../models/energy_service/role.model');
const auditModel = require('../../models/energy_service/audit.model');
const passwordService = require('./password.service');
const tokenService = require('./token.service');
const emailService = require('./email.service');
const otpService = require('./otp.service');
const auditService = require('./audit.service');
const { toPublicCompany } = require('./company.service');

const FORGOT_MESSAGE = 'If an account exists for that email, password reset instructions have been sent.';
const FORGOT_PHONE_MESSAGE = 'If an account exists for that phone number, a verification code has been sent.';

function invalidCredentials() {
  return new AppError('Invalid email or password.', 401, 'INVALID_CREDENTIALS');
}

async function roleIdFor(name, client) {
  const role = await roleModel.findByName(name, client);
  if (!role || role.status !== 'active') {
    throw new AppError('The selected role is not available.', 422, 'INVALID_ROLE');
  }
  return role.id;
}

async function siteCountFor(user, client) {
  if (!user || !user.company_id) return 0;
  return siteModel.countByCompany(user.company_id, client);
}

async function withOnboarding(user, client) {
  const count = await siteCountFor(user, client);
  const onboardingStatus = deriveOnboardingStatus(user, count);
  const company = user && user.company_id
    ? await companyModel.findById(user.company_id, client)
    : null;
  return {
    onboardingStatus,
    onboarding: onboardingFlags(user, count),
    siteCount: count,
    company: company ? toPublicCompany(company) : null,
  };
}

function buildAuthResult(user, session, extras = {}) {
  return {
    user: toPublicUser(user, { onboardingStatus: extras.onboardingStatus }),
    onboardingStatus: extras.onboardingStatus,
    onboarding: extras.onboarding || onboardingFlags(user, extras.siteCount || 0),
    company: extras.company || null,
    accessToken: tokenService.signAccessToken({
      userId: user.id,
      role: user.role,
      sessionId: session.sessionId,
    }),
    refreshToken: session.refreshToken,
    expiresIn: env.accessTokenTtlSeconds,
  };
}

async function issueEmailCode({ userId, email, purpose, ttlMs, client }) {
  const rawToken = tokenService.generateOpaqueToken();
  const expiresAt = new Date(Date.now() + ttlMs);
  await otpModel.invalidateActive(email, purpose, client);
  await otpModel.create({
    userId,
    identifier: email,
    otpCode: tokenService.hashToken(rawToken),
    purpose,
    expiresAt,
    maxAttempts: env.otpMaxAttempts,
  }, client);
  return rawToken;
}

async function register(input, req) {
  passwordService.assertNotSimilarToEmail(input.password, input.email);
  const passwordHash = await passwordService.hashPassword(input.password);
  const client = await pool.connect();
  let user;
  let verificationToken;

  try {
    await client.query('BEGIN');
    const existing = await userModel.findByEmail(input.email, client);
    if (existing) {
      throw new AppError('An account with this email already exists.', 409, 'EMAIL_IN_USE');
    }
    user = await userModel.create({
      email: input.email,
      passwordHash,
      name: input.fullName || input.name,
      roleId: await roleIdFor(ROLES.USER, client),
      status: 'pending_approval',
    }, client);
    verificationToken = await issueEmailCode({
      userId: user.id,
      email: user.email,
      purpose: 'email_verification',
      ttlMs: env.emailVerificationTtlHours * 60 * 60 * 1000,
      client,
    });
    await client.query('COMMIT');
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (_rollbackError) {
      // Ignore rollback failures and surface the original error.
    }
    if (err.code === '23505') {
      throw new AppError('An account with this email already exists.', 409, 'EMAIL_IN_USE');
    }
    throw err;
  } finally {
    client.release();
  }

  await emailService.sendVerification({
    to: user.email,
    fullName: user.name,
    token: verificationToken,
  });
  await auditService.createAuditLog({
    userId: user.id,
    action: 'auth.registration_pending_approval',
    entityType: 'user',
    entityId: user.id,
    description: 'Password registration is awaiting Superadmin approval',
    req,
  });
  return {
    user: toPublicUser(user),
    approvalRequired: true,
    status: 'pending_approval',
    message: 'Your request has been sent to Superadmin. You can continue onboarding after approval.',
  };
}

async function login(input, req) {
  const user = await userModel.findByEmail(input.email);
  if (!user) {
    await passwordService.verifyDummy(input.password);
    await auditService.createAuditLog({
      action: 'auth.login_failed',
      description: 'Failed login',
      req,
      metadata: { reason: 'unknown_user' },
    });
    throw invalidCredentials();
  }

  if (user.status && user.status !== 'active') {
    if (user.status === 'pending_approval') {
      throw new AppError('Your registration is awaiting Superadmin approval.', 403, 'APPROVAL_PENDING');
    }
    throw new AppError('This account is not active.', 403, 'ACCOUNT_INACTIVE');
  }
  if (user.role_status && user.role_status !== 'active') {
    throw new AppError('This account is not active.', 403, 'ACCOUNT_INACTIVE');
  }

  const recentFailures = await auditModel.countRecentFailures(user.id, env.lockoutMinutes);
  const locked = recentFailures >= env.lockoutMaxAttempts;
  const passwordMatches = await passwordService.verifyPassword(user.password_hash, input.password);
  if (!passwordMatches) {
    if (!locked) {
      await auditService.createAuditLog({
        userId: user.id,
        companyId: user.company_id,
        action: 'auth.login_failed',
        description: 'Failed login',
        req,
        metadata: { reason: 'invalid_password' },
      });
    }
    throw invalidCredentials();
  }
  if (locked) {
    await auditService.createAuditLog({
      userId: user.id,
      companyId: user.company_id,
      action: 'auth.suspicious_lockout',
      description: 'Login blocked after repeated failures',
      req,
    });
    throw new AppError('This account is temporarily locked. Try again later.', 423, 'ACCOUNT_LOCKED');
  }

  await userModel.touchLastLogin(user.id);
  const session = await tokenService.createSession({
    userId: user.id,
    ...tokenService.requestMeta(req),
  });
  await auditService.createAuditLog({
    userId: user.id,
    companyId: user.company_id,
    action: 'auth.login',
    description: 'Password login',
    req,
    metadata: { method: 'password' },
  });
  const extras = await withOnboarding(user);
  return buildAuthResult(user, session, extras);
}

async function sendOtp(input, req) {
  const isEmail = Boolean(input.email);
  const identifier = isEmail ? input.email : input.phone;
  const purpose = input.purpose || 'login';
  const user = isEmail
    ? await userModel.findByEmail(identifier)
    : await userModel.findByPhone(identifier);

  if (purpose === 'login' && !user) {
    throw new AppError('No account is registered with that email or phone number.', 404, 'ACCOUNT_NOT_FOUND');
  }
  if (purpose === 'signup' && user) {
    throw new AppError('An account with this email or phone number already exists.', 409, 'ACCOUNT_EXISTS');
  }

  return otpService.sendOtp({
    identifier,
    channel: isEmail ? 'email' : 'sms',
    purpose,
    userId: user ? user.id : null,
    req,
  });
}

async function verifyOtp(input, req) {
  const isEmail = Boolean(input.email);
  const identifier = isEmail ? input.email : input.phone;
  const purpose = input.purpose || 'login';
  await otpService.verifyOtp({
    identifier,
    purpose,
    otp: input.otp,
    req,
  });

  return withTransaction(async (client) => {
    let user = isEmail
      ? await userModel.findByEmail(identifier, client)
      : await userModel.findByPhone(identifier, client);
    let created = false;
    if (!user) {
      if (purpose !== 'signup') {
        throw new AppError('No account is registered with that email or phone number.', 404, 'ACCOUNT_NOT_FOUND');
      }
      try {
        user = await userModel.create({
          email: isEmail ? identifier : null,
          phone: isEmail ? null : identifier,
          name: input.fullName ? input.fullName.trim() : null,
          roleId: await roleIdFor(ROLES.OWNER, client),
          status: 'pending_approval',
          emailVerified: isEmail,
          phoneVerified: !isEmail,
        }, client);
        created = true;
      } catch (err) {
        if (err.code !== '23505') throw err;
        user = isEmail
          ? await userModel.findByEmail(identifier, client)
          : await userModel.findByPhone(identifier, client);
      }
    }
    if (created && purpose === 'signup') {
      await auditService.createAuditLog({
        userId: user.id,
        action: 'auth.registration_pending_approval',
        entityType: 'user',
        entityId: user.id,
        description: 'OTP-verified registration is awaiting Superadmin approval',
        req,
        client,
      });
      return {
        approvalRequired: true,
        status: 'pending_approval',
        user: toPublicUser(user),
        message: 'Your request has been sent to Superadmin. You can continue onboarding after approval.',
      };
    }
    if (user.status === 'pending_approval') {
      throw new AppError(
        'Your registration is awaiting Superadmin approval.',
        403,
        'APPROVAL_PENDING',
      );
    }
    if (user.status && user.status !== 'active') {
      throw new AppError('This account is not active.', 403, 'ACCOUNT_INACTIVE');
    }

    if (isEmail) await userModel.setEmailVerified(user.id, client);
    else await userModel.setPhoneVerified(user.id, client);
    await userModel.touchLastLogin(user.id, client);
    user = await userModel.findById(user.id, client);
    const extras = await withOnboarding(user, client);
    const session = await tokenService.createSession({
      userId: user.id,
      ...tokenService.requestMeta(req),
    }, client);
    await auditService.createAuditLog({
      userId: user.id,
      companyId: user.company_id,
      action: 'auth.login',
      description: created ? 'OTP signup' : 'OTP login',
      req,
      metadata: { method: 'otp', channel: isEmail ? 'email' : 'sms', created },
      client,
    });
    return buildAuthResult(user, session, extras);
  });
}

async function refresh(rawToken, req) {
  const session = await tokenService.rotateRefreshToken(rawToken, tokenService.requestMeta(req));
  const user = await userModel.findById(session.userId);
  if (!user || user.status !== 'active') {
    throw new AppError('Invalid session.', 401, 'INVALID_SESSION');
  }
  const extras = await withOnboarding(user);
  return buildAuthResult(user, session, extras);
}

async function logout(rawToken, req) {
  await tokenService.revokeRawToken(rawToken);
  await auditService.createAuditLog({
    action: 'auth.logout',
    description: 'Logout',
    req,
  });
}

async function logoutAll(userId, req) {
  await sessionModel.revokeAllForUser(userId);
  await auditService.createAuditLog({
    userId,
    action: 'auth.logout_all',
    description: 'All sessions revoked',
    req,
  });
}

async function listSessions(userId, currentSessionId) {
  const rows = await sessionModel.listByUser(userId);
  const now = Date.now();
  return {
    sessions: rows.map((row) => {
      const expired = new Date(row.expires_at).getTime() <= now;
      const revoked = Boolean(row.revoked_at) || expired;
      return {
        id: row.id,
        deviceId: row.device_id,
        deviceName: row.device_name,
        userAgent: row.user_agent,
        ipAddress: row.ip_address,
        lastUsedAt: row.last_used_at,
        expiresAt: row.expires_at,
        revoked,
        current: row.id === currentSessionId,
        createdAt: row.created_at,
      };
    }),
  };
}

async function revokeSession(userId, sessionId, currentSessionId, req) {
  if (sessionId === currentSessionId) {
    throw new AppError('Use logout to end the current session.', 400, 'CURRENT_SESSION');
  }
  const revoked = await sessionModel.revokeById(userId, sessionId);
  if (!revoked) throw new AppError('Session not found.', 404, 'NOT_FOUND');
  await auditService.createAuditLog({
    userId,
    action: 'session.revoked',
    entityType: 'session',
    entityId: sessionId,
    description: 'Session revoked',
    req,
  });
  return { message: 'Session revoked.' };
}

async function forgotPassword(input, req) {
  if (input.phone) {
    const user = await userModel.findByPhone(input.phone);
    if (user && user.status === 'active') {
      await otpService.sendOtp({
        phone: input.phone,
        purpose: 'forgot_password',
        userId: user.id,
        req,
      });
    }
    return FORGOT_PHONE_MESSAGE;
  }

  const user = await userModel.findByEmail(input.email);
  if (!user) return FORGOT_MESSAGE;

  const rawToken = await issueEmailCode({
    userId: user.id,
    email: user.email,
    purpose: 'forgot_password',
    ttlMs: env.passwordResetTtlMinutes * 60 * 1000,
  });
  await emailService.sendPasswordReset({
    to: user.email,
    fullName: user.name || 'there',
    token: rawToken,
  });
  await auditService.createAuditLog({
    userId: user.id,
    companyId: user.company_id,
    action: 'auth.password_reset_requested',
    description: 'Password reset requested',
    req,
  });
  return FORGOT_MESSAGE;
}

async function resetPassword(input, req) {
  if (input.phone && input.otp) {
    await otpService.verifyOtp({
      phone: input.phone,
      purpose: 'forgot_password',
      otp: input.otp,
      req,
    });
    return withTransaction(async (client) => {
      const user = await userModel.findByPhone(input.phone, client);
      if (!user) {
        throw new AppError('This reset code is invalid or has expired.', 400, 'INVALID_RESET_TOKEN');
      }
      await applyNewPassword(user, input.password, client);
      await sessionModel.revokeAllForUser(user.id, client);
      await auditService.createAuditLog({
        userId: user.id,
        companyId: user.company_id,
        action: 'auth.password_reset',
        description: 'Password reset',
        req,
        metadata: { method: 'otp' },
        client,
      });
    });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const record = await otpModel.findPendingByCodeForUpdate(
      tokenService.hashToken(input.token),
      'forgot_password',
      client,
    );
    if (!record || new Date(record.expires_at).getTime() <= Date.now()) {
      throw new AppError('This reset code is invalid or has expired.', 400, 'INVALID_RESET_TOKEN');
    }
    const user = await userModel.findById(record.user_id, client);
    if (!user) {
      throw new AppError('This reset code is invalid or has expired.', 400, 'INVALID_RESET_TOKEN');
    }
    await applyNewPassword(user, input.password, client);
    await otpModel.markVerified(record.id, client);
    await sessionModel.revokeAllForUser(user.id, client);
    await client.query('COMMIT');
    await auditService.createAuditLog({
      userId: user.id,
      companyId: user.company_id,
      action: 'auth.password_reset',
      description: 'Password reset',
      req,
      metadata: { method: 'email' },
    });
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (_rollbackError) {
      // Preserve the original error when the transaction is already closed.
    }
    throw err;
  } finally {
    client.release();
  }
}

async function applyNewPassword(user, password, client) {
  if (user.email) {
    passwordService.assertNotSimilarToEmail(password, user.email);
  }
  if (user.password_hash) {
    const samePassword = await passwordService.verifyPassword(user.password_hash, password);
    if (samePassword) {
      throw new AppError('Choose a password you have not used before.', 422, 'PASSWORD_REUSE');
    }
  }
  const passwordHash = await passwordService.hashPassword(password);
  await userModel.updatePassword(user.id, passwordHash, client);
}

async function changePassword({ userId, sessionId, currentPassword, newPassword, req }) {
  const user = await userModel.findById(userId);
  if (!user) throw new AppError('Unauthorized.', 401, 'UNAUTHORIZED');
  if (!user.password_hash) {
    throw new AppError('Set a password before changing it.', 400, 'PASSWORD_NOT_SET');
  }

  const currentMatches = await passwordService.verifyPassword(user.password_hash, currentPassword);
  if (!currentMatches) {
    throw new AppError('Current password is incorrect.', 401, 'INVALID_CREDENTIALS');
  }
  if (currentPassword === newPassword) {
    throw new AppError('Choose a different password.', 422, 'PASSWORD_REUSE');
  }
  await withTransaction(async (client) => {
    await applyNewPassword(user, newPassword, client);
    await sessionModel.revokeAllExcept(user.id, sessionId, client);
  });
  await auditService.createAuditLog({
    userId,
    companyId: user.company_id,
    action: 'auth.password_changed',
    description: 'Password changed',
    req,
  });
}

async function setPassword({ userId, password, req }) {
  const user = await userModel.findById(userId);
  if (!user) throw new AppError('Unauthorized.', 401, 'UNAUTHORIZED');
  if (user.password_hash) {
    throw new AppError('A password is already set. Use change password instead.', 409, 'PASSWORD_ALREADY_SET');
  }
  if (user.email) {
    passwordService.assertNotSimilarToEmail(password, user.email);
  }
  const passwordHash = await passwordService.hashPassword(password);
  await userModel.updatePassword(user.id, passwordHash);
  await auditService.createAuditLog({
    userId,
    companyId: user.company_id,
    action: 'auth.password_set',
    description: 'Password set',
    req,
  });
  return { message: 'Password set.' };
}

async function getMe(userId) {
  const user = await userModel.findById(userId);
  if (!user) throw new AppError('Unauthorized.', 401, 'UNAUTHORIZED');
  const extras = await withOnboarding(user);
  const company = user.company_id ? await companyModel.findById(user.company_id) : null;
  return {
    user: toPublicUser(user, { onboardingStatus: extras.onboardingStatus }),
    onboardingStatus: extras.onboardingStatus,
    onboarding: extras.onboarding,
    company: company ? toPublicCompany(company) : null,
  };
}

async function updateProfile({ userId, fullName, name }) {
  const user = await userModel.updateProfile(userId, { name: name || fullName });
  if (!user) throw new AppError('Unauthorized.', 401, 'UNAUTHORIZED');
  const extras = await withOnboarding(user);
  return toPublicUser(user, { onboardingStatus: extras.onboardingStatus });
}

async function verifyEmail({ token, currentUserId }) {
  const client = await pool.connect();
  let userId;
  try {
    await client.query('BEGIN');
    const record = await otpModel.findPendingByCodeForUpdate(
      tokenService.hashToken(token),
      'email_verification',
      client,
    );
    const expired = !record || new Date(record.expires_at).getTime() <= Date.now();
    if (expired || (currentUserId && currentUserId !== record.user_id)) {
      throw new AppError(
        'This verification code is invalid or has expired.',
        400,
        'INVALID_VERIFICATION_TOKEN',
      );
    }
    userId = record.user_id;
    await userModel.setEmailVerified(userId, client);
    await otpModel.markVerified(record.id, client);
    await client.query('COMMIT');
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (_rollbackError) {
      // Preserve the original error when the transaction is already closed.
    }
    throw err;
  } finally {
    client.release();
  }

  const user = await userModel.findById(userId);
  await auditService.createAuditLog({
    userId,
    companyId: user && user.company_id,
    action: 'auth.email_verified',
    description: 'Email verified',
  });
  return toPublicUser(user);
}

async function resendVerification(userId) {
  const user = await userModel.findById(userId);
  if (!user) throw new AppError('Unauthorized.', 401, 'UNAUTHORIZED');
  if (!user.email) {
    throw new AppError('Add an email address before verifying.', 400, 'EMAIL_REQUIRED');
  }
  if (user.email_verified) {
    return { alreadyVerified: true };
  }
  const client = await pool.connect();
  let verificationToken;
  try {
    await client.query('BEGIN');
    verificationToken = await issueEmailCode({
      userId: user.id,
      email: user.email,
      purpose: 'email_verification',
      ttlMs: env.emailVerificationTtlHours * 60 * 60 * 1000,
      client,
    });
    await client.query('COMMIT');
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (_rollbackError) {
      // Preserve the original error when the transaction is already closed.
    }
    throw err;
  } finally {
    client.release();
  }
  await emailService.sendVerification({
    to: user.email,
    fullName: user.name || 'there',
    token: verificationToken,
  });
  return { alreadyVerified: false };
}

module.exports = {
  register,
  login,
  sendOtp,
  verifyOtp,
  refresh,
  logout,
  logoutAll,
  listSessions,
  revokeSession,
  forgotPassword,
  resetPassword,
  changePassword,
  setPassword,
  getMe,
  updateProfile,
  verifyEmail,
  resendVerification,
  FORGOT_MESSAGE,
};
