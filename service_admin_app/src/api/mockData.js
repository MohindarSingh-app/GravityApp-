/**
 * Frontend-only fallback data.
 * Jab backend connect na ho (NETWORK error), toh ye data use hoga
 * taaki app crash na kare aur dashboard/screen chal rahe rahein.
 * Ye sirf local demo/offline mode ke liye hai — backend se kuch nahi badla.
 */

export const MOCK_USER = {
  id: 'dev-user-1',
  fullName: 'Demo User',
  name: 'Demo User',
  email: 'demo@example.com',
  role: 'MAINTENANCE_HEAD',
  phone: '+91 90000 00000',
};

export const MOCK_COMPANY = {
  id: 'demo-company-1',
  name: 'Demo Plant Ltd.',
  city: 'Indore',
  gstin: '22AAAAA0000A1Z5',
};

export const MOCK_ACCESS = {
  updateCompany: true,
  createSites: true,
  updateSites: true,
  readSites: true,
  readSessions: true,
  readApiKeys: true,
  readPeople: true,
  readMarketplace: true,
  readCerts: true,
  readAmc: true,
  createRepairs: true,
};

export const MOCK_SUMMARY = {
  sites: { active: 2, total: 3, primaryName: 'Main Plant' },
  people: { active: 4, byRole: { SITE_ENGINEER: 2, MAINTENANCE_HEAD: 1, PURCHASE_MGR: 1 } },
  sessions: { active: 1, current: true },
  apiKeys: { active: 2, revoked: 0, expired: 0 },
};

export const MOCK_OPERATIONS = {
  place: 'Indore Main Plant',
  liveJob: null,
  jobs: [
    {
      id: 'job-101',
      title: 'Panel MCC Inspection',
      code: 'MCC-2026-001',
      when: 'Today 10:00 AM',
      status: 'in_progress',
      engineerName: 'Ramesh Verma',
      specialist: 'Electrical',
      rating: 4.5,
      location: 'Main Plant - Block A',
      slaLabel: 'SLA: 4h',
    },
    {
      id: 'job-102',
      title: 'VFD Servo Calibration',
      code: 'VFD-2026-002',
      when: 'Tomorrow 09:00 AM',
      status: 'open',
      engineerName: 'Priya Sharma',
      specialist: 'Automation',
      rating: null,
      location: 'Block B - Line 2',
      slaLabel: 'SLA: 8h',
    },
  ],
  services: [],
  metrics: {
    activeJobs: 2,
    slaRisk: 0,
    amcActive: 1,
    certsExpiring: 0,
  },
  recommendation: null,
};

export const MOCK_DASHBOARD = {
  company: MOCK_COMPANY,
  operations: MOCK_OPERATIONS,
  summary: MOCK_SUMMARY,
  access: MOCK_ACCESS,
};

/**
 * Kisi API path ke liye mock fallback return kareta hai.
 * Agar koi mock nahi mila toh null return kareta hai.
 */
export function getMockForPath(path) {
  // Normalize query strings
  const basePath = path.split('?')[0];

  switch (basePath) {
    case '/api/auth/send-otp':
      return { success: true, data: { expiresIn: 300, cooldownSeconds: 30, __offline: true } };

    case '/api/auth/verify-otp':
      return { success: true, data: { accessToken: 'dev-token', refreshToken: 'dev-refresh', user: MOCK_USER, company: MOCK_COMPANY, onboardingStatus: 'ONBOARDING_COMPLETED', onboarding: true, __offline: true } };

    case '/api/auth/me':
      return { success: true, data: { user: MOCK_USER, company: MOCK_COMPANY, onboardingStatus: 'ONBOARDING_COMPLETED', onboarding: true } };

    case '/api/dashboard':
      return { success: true, data: MOCK_DASHBOARD };

    case '/api/notifications':
      return { success: true, data: { notifications: [], unreadCount: 0 } };

    case '/api/companies/mine':
      return { success: true, data: { company: MOCK_COMPANY } };

    case '/api/companies':
      return { success: true, data: { companies: [MOCK_COMPANY] } };

    case '/api/profile':
      return { success: true, data: { profile: MOCK_USER } };

    case '/api/api-keys':
      return { success: true, data: { apiKeys: [] } };

    case '/api/auth/sessions':
      return { success: true, data: { sessions: [] } };

    case '/api/roles':
      return { success: true, data: { roles: [] } };

    case '/api/field/jobs':
      return { success: true, data: { jobs: MOCK_OPERATIONS.jobs } };

    case '/api/field/catalog':
      return { success: true, data: { groups: [] } };

    case '/api/field/products':
      return { success: true, data: { products: [] } };

    case '/api/field/amc':
      return { success: true, data: { amc: null } };

    case '/api/field/certs':
      return { success: true, data: { certs: [] } };

    case '/api/catalog':
      return { success: true, data: { groups: [] } };

    default:
      return null;
  }
}
