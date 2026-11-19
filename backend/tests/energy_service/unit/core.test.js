const { test } = require('node:test');
const assert = require('node:assert/strict');
const { isValidGstin, gstinChecksumChar } = require('../../../src/utils/energy_service/gst');
const { normalizePhone, isValidPhone } = require('../../../src/utils/energy_service/phone');
const { deriveOnboardingStatus, ONBOARDING } = require('../../../src/constants/energy_service/onboarding');

test('accepts format-correct GSTIN values and rejects malformed values', () => {
  const base = '27AAPFU0939F1Z';
  const valid = `${base}${gstinChecksumChar(base)}`;
  assert.equal(isValidGstin(valid), true);
  assert.equal(isValidGstin('08ABCDE1234F1Z0'), true);
  assert.equal(isValidGstin('27AAPFU0939F1Z0'), true);
  assert.equal(isValidGstin('27AAPFU0939F1Z'), false);
  assert.equal(isValidGstin('not-a-gst'), false);
});

test('normalizes Indian phone numbers to E.164', () => {
  assert.equal(normalizePhone('9876543210'), '+919876543210');
  assert.equal(normalizePhone('+91 98765 43210'), '+919876543210');
  assert.equal(isValidPhone('12345'), false);
});

test('derives onboarding resume state from stored data', () => {
  assert.equal(deriveOnboardingStatus({ phone_verified_at: null, password_hash: null }), ONBOARDING.OTP_PENDING);
  assert.equal(deriveOnboardingStatus({ email_verified: true, company_id: null }), ONBOARDING.COMPANY_PENDING);
  assert.equal(deriveOnboardingStatus({ phone_verified_at: new Date(), company_id: null }), ONBOARDING.COMPANY_PENDING);
  assert.equal(deriveOnboardingStatus({ email_verified: true, company_id: 'x', full_name: null }, 0), ONBOARDING.SITES_PENDING);
  assert.equal(deriveOnboardingStatus({ email_verified: true, company_id: 'x', full_name: null }, 1), ONBOARDING.PROFILE_PENDING);
  assert.equal(deriveOnboardingStatus({ email_verified: true, company_id: 'x', full_name: 'Amina Shah' }, 1), ONBOARDING.ONBOARDING_COMPLETED);
  assert.equal(deriveOnboardingStatus({ phone_verified_at: new Date(), company_id: 'x', full_name: null }, 0), ONBOARDING.SITES_PENDING);
  assert.equal(deriveOnboardingStatus({ phone_verified_at: new Date(), company_id: 'x', full_name: null }, 1), ONBOARDING.PROFILE_PENDING);
  assert.equal(deriveOnboardingStatus({ phone_verified_at: new Date(), company_id: 'x', full_name: 'Amina Shah' }, 1), ONBOARDING.ONBOARDING_COMPLETED);
});
