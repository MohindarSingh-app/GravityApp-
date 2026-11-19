const crypto = require('crypto');
const argon2 = require('argon2');
const AppError = require('../../utils/energy_service/AppError');

const ARGON_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

let dummyHash;

async function warmUp() {
  dummyHash = await argon2.hash(crypto.randomBytes(32).toString('hex'), ARGON_OPTIONS);
}

async function hashPassword(password) {
  return argon2.hash(password, ARGON_OPTIONS);
}

async function verifyPassword(passwordHash, password) {
  try {
    return await argon2.verify(passwordHash, password);
  } catch (_err) {
    return false;
  }
}

async function verifyDummy(password) {
  if (!dummyHash) await warmUp();
  try {
    await argon2.verify(dummyHash, password);
  } catch (_err) {
    // The result is ignored. This only keeps the missing-user path similar in cost.
  }
}

function assertNotSimilarToEmail(password, email) {
  const localPart = email.split('@')[0] || '';
  if (localPart.length >= 3 && password.toLowerCase().includes(localPart.toLowerCase())) {
    throw new AppError(
      'Password is too similar to the email address.',
      422,
      'VALIDATION_ERROR',
    );
  }
}

module.exports = {
  warmUp,
  hashPassword,
  verifyPassword,
  verifyDummy,
  assertNotSimilarToEmail,
};
