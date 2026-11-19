const AppError = require('../../utils/energy_service/AppError');
const { can } = require('../../services/energy_service/rbac.service');

function requireRole(...roles) {
  return function roleGuard(req, _res, next) {
    if (!req.auth || !roles.includes(req.auth.role)) {
      return next(new AppError('You do not have access to this area.', 403, 'FORBIDDEN'));
    }
    return next();
  };
}

function requireAccess(action) {
  return function accessGuard(req, _res, next) {
    if (!req.auth || !can(req.auth.role, action)) {
      return next(new AppError('You do not have access to this area.', 403, 'FORBIDDEN'));
    }
    return next();
  };
}

function requireVerifiedEmail(req, _res, next) {
  if (!req.auth || !req.auth.emailVerified) {
    return next(new AppError('Verify your email before continuing.', 403, 'EMAIL_NOT_VERIFIED'));
  }
  return next();
}

module.exports = { requireRole, requireAccess, requireVerifiedEmail };
