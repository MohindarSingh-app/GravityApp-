import { normalizePhone } from './phone';
import { validateEmail, validatePhone } from './validators';

export function parseAuthIdentifier(value) {
  const input = String(value || '').trim();
  if (input.includes('@')) {
    const error = validateEmail(input);
    return error ? { error } : { email: input.toLowerCase() };
  }

  const error = validatePhone(input);
  return error ? { error } : { phone: normalizePhone(input) };
}