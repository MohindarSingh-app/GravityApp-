const ONBOARDING = {
  OTP_PENDING: 'OTP_PENDING',
  PHONE_VERIFIED: 'PHONE_VERIFIED',
  COMPANY_PENDING: 'COMPANY_PENDING',
  COMPANY_COMPLETED: 'COMPANY_COMPLETED',
  SITES_PENDING: 'SITES_PENDING',
  SITES_COMPLETED: 'SITES_COMPLETED',
  PROFILE_PENDING: 'PROFILE_PENDING',
  ONBOARDING_COMPLETED: 'ONBOARDING_COMPLETED',
};

function hasProfile(user) {
  const name = user && (user.name || user.full_name);
  return Boolean(name && String(name).trim().length >= 2);
}

function hasVerifiedContact(user) {
  return Boolean(user && (
    user.phone_verified
    || user.phone_verified_at
    || user.email_verified
    || user.email_verified_at
  ));
}

function deriveOnboardingStatus(user, siteCount = 0) {
  if (!user) return ONBOARDING.OTP_PENDING;
  if (!hasVerifiedContact(user) && !user.password_hash) return ONBOARDING.OTP_PENDING;
  if (!user.company_id) return ONBOARDING.COMPANY_PENDING;
  if (!siteCount) return ONBOARDING.SITES_PENDING;
  if (!hasProfile(user)) return ONBOARDING.PROFILE_PENDING;
  return ONBOARDING.ONBOARDING_COMPLETED;
}

function onboardingFlags(user, siteCount = 0) {
  const status = deriveOnboardingStatus(user, siteCount);
  return {
    status,
    phoneVerified: Boolean(user && (user.phone_verified || user.phone_verified_at)),
    emailVerified: Boolean(user && (user.email_verified || user.email_verified_at)),
    contactVerified: hasVerifiedContact(user),
    companyCompleted: Boolean(user && user.company_id),
    sitesCompleted: Number(siteCount) > 0,
    profileCompleted: hasProfile(user),
  };
}

module.exports = {
  ONBOARDING,
  deriveOnboardingStatus,
  onboardingFlags,
  hasProfile,
};
