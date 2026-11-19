const rateLimit = require('express-rate-limit');
const { env } = require('../../config/energy_service/env');

let skipRateLimit = false;

function setSkipRateLimit(value) {
  skipRateLimit = Boolean(value);
}

function buildLimiter({ windowMs, max }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false,
    skip: () => skipRateLimit,
    handler(_req, res) {
      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many requests. Please wait and try again.',
        },
      });
    },
  });
}

const apiLimiter = buildLimiter({
  windowMs: env.apiRateLimitWindowMs,
  max: env.apiRateLimitMax,
});

const authLimiter = buildLimiter({
  windowMs: env.authRateLimitWindowMs,
  max: env.authRateLimitMax,
});

const refreshLimiter = buildLimiter({
  windowMs: env.authRateLimitWindowMs,
  max: env.refreshRateLimitMax,
});

const otpLimiter = buildLimiter({
  windowMs: env.authRateLimitWindowMs,
  max: env.otpRateLimitMax,
});

module.exports = { apiLimiter, authLimiter, refreshLimiter, otpLimiter, setSkipRateLimit, buildLimiter };
