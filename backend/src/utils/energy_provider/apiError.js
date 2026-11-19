/**
 * Shared helpers used across services and controllers.
 */

const { db } = require('../../db/energy_provider/index');

/** Error carrying an HTTP status code so controllers can stay thin. */
class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }

  static badRequest(message, details) {
    return new ApiError(400, message, details);
  }

  static unauthorized(message = 'Authentication token required') {
    return new ApiError(401, message);
  }

  static forbidden(message = 'Not authorised for this resource') {
    return new ApiError(403, message);
  }

  static notFound(message = 'Resource not found') {
    return new ApiError(404, message);
  }

  static conflict(message, details) {
    return new ApiError(409, message, details);
  }

  static serviceUnavailable(message, details) {
    return new ApiError(503, message, details);
  }
}

/** Wrap an async controller so rejected promises reach the error handler. */
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

/** Standard success envelope used by every endpoint. */
const ok = (res, message, data) =>
  res.json({ success: true, message, data: data === undefined ? null : data });

/** Indian mobile number validation (10 digits starting 6-9). */
const isValidMobile = (mobile) => /^[6-9]\d{9}$/.test(String(mobile || '').trim());

/** IFSC code validation - 4 letters, 0, then 6 alphanumerics. */
const isValidIfsc = (ifsc) => /^[A-Z]{4}0[A-Z0-9]{6}$/.test(String(ifsc || '').trim());

/** Basic email validation. */
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(email || '').trim());

/** Mask a phone number for partners who must not see the raw number. */
const maskPhone = (phone) => {
  const value = String(phone || '');
  if (value.length < 4) return '***';
  return `${'*'.repeat(value.length - 4)}${value.slice(-4)}`;
};

module.exports = {
  ApiError,
  asyncHandler,
  ok,
  isValidMobile,
  isValidIfsc,
  isValidEmail,
  maskPhone,
  db,
};
