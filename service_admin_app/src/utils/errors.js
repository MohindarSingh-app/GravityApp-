export class ApiError extends Error {
  constructor(message, status, code, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function getErrorMessage(error) {
  if (error && Array.isArray(error.details) && error.details[0] && error.details[0].message) {
    return error.details[0].message;
  }
  if (error && error.message) return error.message;
  return 'Something went wrong. Please try again.';
}

export function fieldErrors(error) {
  const map = {};
  if (!error || !Array.isArray(error.details)) return map;
  error.details.forEach((item) => {
    const key = String(item.path || '').replace(/^body\./, '').split('.').pop();
    if (key && item.message && !map[key]) map[key] = item.message;
  });
  return map;
}

export function retryAfterSeconds(error) {
  const details = error && error.details;
  if (details && typeof details.retryAfterSeconds === 'number') {
    return details.retryAfterSeconds;
  }
  return 0;
}

export function otpFailureMessage(error, expiredLocally) {
  if (expiredLocally) return 'This code has expired. Request a new one.';
  if (!error) return '';
  if (error.code === 'OTP_ATTEMPT_LIMIT') return error.message;
  if (error.code === 'INVALID_OTP') return 'The verification code is invalid or has expired.';
  if (error.code === 'OTP_COOLDOWN' || error.code === 'OTP_RATE_LIMITED') return error.message;
  return getErrorMessage(error);
}
