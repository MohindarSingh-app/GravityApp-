export const ONBOARDING = {
  OTP_PENDING: 'OTP_PENDING',
  PHONE_VERIFIED: 'PHONE_VERIFIED',
  COMPANY_PENDING: 'COMPANY_PENDING',
  COMPANY_COMPLETED: 'COMPANY_COMPLETED',
  SITES_PENDING: 'SITES_PENDING',
  SITES_COMPLETED: 'SITES_COMPLETED',
  PROFILE_PENDING: 'PROFILE_PENDING',
  ONBOARDING_COMPLETED: 'ONBOARDING_COMPLETED',
};

export const ONBOARDING_STEPS = [
  { key: 'verify', label: 'Verify' },
  { key: 'company', label: 'Company' },
  { key: 'sites', label: 'Sites' },
  { key: 'you', label: 'You' },
];

export function isOnboardingComplete(status) {
  return status === ONBOARDING.ONBOARDING_COMPLETED;
}

export function stepIndexForStatus(status, authenticated) {
  if (!authenticated) return 0;
  switch (status) {
    case ONBOARDING.SITES_PENDING:
    case ONBOARDING.SITES_COMPLETED:
      return 2;
    case ONBOARDING.PROFILE_PENDING:
    case ONBOARDING.ONBOARDING_COMPLETED:
      return 3;
    case ONBOARDING.OTP_PENDING:
    case ONBOARDING.PHONE_VERIFIED:
    case ONBOARDING.COMPANY_PENDING:
    case ONBOARDING.COMPANY_COMPLETED:
    default:
      return 1;
  }
}

export function onboardingRouteForStatus(status) {
  switch (status) {
    case ONBOARDING.SITES_PENDING:
    case ONBOARDING.SITES_COMPLETED:
      return 'Sites';
    case ONBOARDING.PROFILE_PENDING:
      return 'Profile';
    case ONBOARDING.ONBOARDING_COMPLETED:
      return 'OnboardingComplete';
    case ONBOARDING.PHONE_VERIFIED:
    case ONBOARDING.COMPANY_PENDING:
    case ONBOARDING.COMPANY_COMPLETED:
    case ONBOARDING.OTP_PENDING:
    default:
      return 'CompanyDetails';
  }
}

export function onboardingStatusLabel(status) {
  switch (status) {
    case ONBOARDING.ONBOARDING_COMPLETED:
      return 'Onboarding complete';
    case ONBOARDING.PROFILE_PENDING:
      return 'Profile still needed';
    case ONBOARDING.SITES_PENDING:
    case ONBOARDING.SITES_COMPLETED:
      return 'Sites still needed';
    case ONBOARDING.COMPANY_PENDING:
    case ONBOARDING.COMPANY_COMPLETED:
    case ONBOARDING.PHONE_VERIFIED:
      return 'Company still needed';
    default:
      return 'Setup in progress';
  }
}
