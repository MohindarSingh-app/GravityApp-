const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '..', '.env') });
const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PRODUCTION = NODE_ENV === 'production';
const IS_TEST = NODE_ENV === 'test';

/**
 * Central runtime configuration.
 *
 * Every credential / connection detail is read from the environment so nothing
 * sensitive is hard-coded.  See `.env.example` for the full list of supported
 * variables.
 */
module.exports = {
  PORT: parseInt(process.env.PORT, 10) || 3000,
  NODE_ENV,
  JWT_SECRET: process.env.JWT_SECRET || (IS_PRODUCTION ? '' : 'development-only-energy-hub-secret'),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  REFRESH_TOKEN_EXPIRES_IN: process.env.REFRESH_TOKEN_EXPIRES_IN || '30d',
  OTP_TTL_MS: parseInt(process.env.OTP_TTL_MS, 10) || 10 * 60 * 1000,
  OTP_MAX_ATTEMPTS: parseInt(process.env.OTP_MAX_ATTEMPTS, 10) || 5,
  OTP_RESEND_COOLDOWN_MS:
    parseInt(process.env.OTP_RESEND_COOLDOWN_MS, 10) || 30 * 1000,
  SMS_PROVIDER_URL: process.env.SMS_PROVIDER_URL || '',
  SMS_PROVIDER_TOKEN: process.env.SMS_PROVIDER_TOKEN || '',
  SMS_SENDER_ID: process.env.SMS_SENDER_ID || '',
  FIXED_MOBILE: process.env.FIXED_MOBILE || (IS_PRODUCTION ? '' : '0987654321'),
  FIXED_OTP: process.env.FIXED_OTP || (IS_PRODUCTION ? '' : '123456'),
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
  DATA_DIR: path.join(__dirname, '..', '..', '..', 'data', 'energy_provider'),

  // ------------------------------------------------------------------
  // Database
  // ------------------------------------------------------------------
  // DATABASE_URL is the single source of truth.  Supported schemes:
  //   postgres://user:pass@host:port/database
  //   mysql://user:pass@host:port/database
  //   sqlite://./data/energy_hub.db      (relative to the backend folder)
  // When DATABASE_URL is not set the discrete DB_* variables below are used
  // to build a PostgreSQL URL, so both styles of configuration work.
  DATABASE_URL: process.env.DATABASE_URL || process.env.HUB_DATABASE_URL || '',
  DB_HOST: process.env.DB_HOST || process.env.HUB_DB_HOST || '127.0.0.1',
  DB_PORT: parseInt(process.env.DB_PORT || process.env.HUB_DB_PORT, 10) || 5432,
  DB_USER: process.env.DB_USER || process.env.HUB_DB_USER || 'postgres',
  DB_PASSWORD: process.env.DB_PASSWORD || process.env.HUB_DB_PASSWORD || '',
  DB_NAME: process.env.DB_NAME || process.env.HUB_DB_NAME || 'energy_hub',
  DB_SSL: (process.env.DB_SSL || process.env.HUB_DB_SSL) === 'true',

  // Seed a demo partner set on first boot (development convenience only).
  SEED_DEMO_DATA:
    NODE_ENV === 'development' && process.env.SEED_DEMO_DATA !== 'false',
};
