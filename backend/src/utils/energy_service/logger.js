const SENSITIVE_KEY = /password|token|authorization|secret|cookie|hash|otp|api[_-]?key/i;

function redact(value, depth) {
  if (depth > 6) return '[truncated]';
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        SENSITIVE_KEY.test(key) ? '[redacted]' : redact(item, depth + 1),
      ]),
    );
  }
  return value;
}

function logError(err) {
  const safe = {
    name: err && err.name ? err.name : 'Error',
    message: err && err.message ? err.message : 'Unknown error',
    code: err && (err.code || err.statusCode) ? err.code || err.statusCode : undefined,
  };
  if (process.env.NODE_ENV !== 'production' && err && err.stack && !err.isOperational) {
    safe.stack = err.stack;
  }
  console.error(JSON.stringify(redact(safe, 0)));
}

module.exports = { redact, logError };
