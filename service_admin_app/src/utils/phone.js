const E164 = /^\+[1-9]\d{7,14}$/;
const IN_DIGITS = /^[6-9]\d{9}$/;

export function normalizePhone(value) {
  const raw = String(value || '').trim();
  if (!raw) {
    throw new Error('Enter a valid phone number.');
  }
  /* Strip everything except digits and leading + */
  const digits = raw.replace(/[^\d+]/g, '');
  let candidate = digits;

  if (candidate.startsWith('+')) {
    /* Already has country code — keep + and digits only */
    candidate = `+${candidate.slice(1).replace(/\D/g, '')}`;
  } else {
    const only = candidate.replace(/\D/g, '');
    /* Remove a leading zero if present (e.g. 09876543210 -> 9876543210) */
    const normalized = only.startsWith('0') ? only.slice(1) : only;
    if (normalized.length === 10 && IN_DIGITS.test(normalized)) {
      candidate = `+91${normalized}`;
    } else if (normalized.length === 12 && normalized.startsWith('91') && IN_DIGITS.test(normalized.slice(2))) {
      candidate = `+${normalized}`;
    } else {
      candidate = `+${normalized}`;
    }
  }
  if (!E164.test(candidate)) {
    throw new Error('Enter a valid 10-digit mobile number (e.g. 9876543210).');
  }
  return candidate;
}

export function formatPhone(value) {
  try {
    return normalizePhone(value);
  } catch (_error) {
    return String(value || '').trim();
  }
}
