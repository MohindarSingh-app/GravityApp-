const AppError = require('./AppError');

const E164 = /^\+[1-9]\d{7,14}$/;
const IN_DIGITS = /^[6-9]\d{9}$/;

function normalizePhone(value) {
  const raw = String(value || '').trim();
  if (!raw) {
    throw new AppError('Enter a valid phone number.', 422, 'VALIDATION_ERROR');
  }
  const digits = raw.replace(/[^\d+]/g, '');
  let candidate = digits;
  if (candidate.startsWith('+')) {
    candidate = `+${candidate.slice(1).replace(/\D/g, '')}`;
  } else {
    const only = candidate.replace(/\D/g, '');
    if (only.length === 10 && IN_DIGITS.test(only)) {
      candidate = `+91${only}`;
    } else if (only.length === 12 && only.startsWith('91') && IN_DIGITS.test(only.slice(2))) {
      candidate = `+${only}`;
    } else {
      candidate = `+${only}`;
    }
  }
  if (!E164.test(candidate)) {
    throw new AppError('Enter a valid phone number.', 422, 'VALIDATION_ERROR');
  }
  return candidate;
}

function isValidPhone(value) {
  try {
    normalizePhone(value);
    return true;
  } catch (_err) {
    return false;
  }
}

module.exports = { normalizePhone, isValidPhone };
