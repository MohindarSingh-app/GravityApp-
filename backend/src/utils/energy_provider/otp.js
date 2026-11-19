const crypto = require('crypto');
const config = require('../../config/energy_provider/env');

/**
 * Generate a 6 digit OTP.
 *
 * In development the configured FIXED_MOBILE always receives FIXED_OTP so the
 * flow can be exercised without an SMS gateway.  In any other environment a
 * cryptographically random code is produced.
 */
const generateOtp = (mobile, options = config) => {
  if (mobile === options.FIXED_MOBILE) {
    return options.FIXED_OTP;
  }
  return crypto.randomInt(100000, 1000000).toString();
};

module.exports = { generateOtp };

