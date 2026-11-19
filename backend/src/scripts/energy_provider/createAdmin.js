const { db } = require('../../db/energy_provider/index');
const UserModel = require('../../models/energy_provider/UserModel');
const { isValidMobile } = require('../../utils/energy_provider/apiError');

const run = async () => {
  const mobile = String(process.argv[2] || '').trim();
  const fullName = String(process.argv[3] || 'EnergyHub Administrator').trim();
  if (!isValidMobile(mobile)) {
    throw new Error('Usage: node scripts/createAdmin.js <10-digit-mobile> [full-name]');
  }
  if (!fullName) throw new Error('Administrator name cannot be empty');

  await db.init();
  const existing = await UserModel.findByMobile(mobile);
  if (existing) {
    if (existing.role === 'admin') {
      console.log('This mobile number is already provisioned as an administrator.');
      return;
    }
    throw new Error('This mobile number already belongs to a non-admin account; no role was changed.');
  }

  await UserModel.create({
    mobile,
    fullName,
    role: 'admin',
    status: 'approved',
  });
  console.log('Administrator account created. Sign in using the configured OTP delivery service.');
};

run()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => db.close());
