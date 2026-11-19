const { can, canAccessCompany } = require('./rbac.service');
const { ROLE_NAMES } = require('../../constants/energy_service/roles');
const companyModel = require('../../models/energy_service/company.model');
const siteModel = require('../../models/energy_service/site.model');
const userModel = require('../../models/energy_service/user.model');
const sessionModel = require('../../models/energy_service/session.model');
const apiKeyModel = require('../../models/energy_service/apiKey.model');
const auditModel = require('../../models/energy_service/audit.model');
const { toPublicCompany } = require('./company.service');
const { toPublicSite } = require('./site.service');
const fieldService = require('./field.service');

const COMPANY_ACTIONS = ['company.created', 'company.updated', 'company.status_changed'];
const SITE_ACTIONS = ['site.created', 'site.updated', 'site.status_changed', 'site.deleted'];
const PEOPLE_ACTIONS = [
  'user.created',
  'user.updated',
  'user.activated',
  'user.deactivated',
  'user.role_changed',
  'role.updated',
  'role.status_changed',
];
const KEY_ACTIONS = ['api_key.created', 'api_key.revoked', 'api_key.rotated'];

function accessFor(role) {
  return {
    readCompany: can(role, 'companies.read'),
    updateCompany: can(role, 'companies.update'),
    readSites: can(role, 'sites.read'),
    createSites: can(role, 'sites.create'),
    updateSites: can(role, 'sites.update'),
    deleteSites: can(role, 'sites.delete'),
    readPeople: can(role, 'users.read'),
    managePeople: can(role, 'users.manage'),
    readSessions: can(role, 'sessions.read'),
    readApiKeys: can(role, 'api_keys.read'),
    readJobs: can(role, 'jobs.read'),
    createJobs: can(role, 'jobs.create'),
    updateJobs: can(role, 'jobs.update'),
    readAmc: can(role, 'amc.read'),
    quoteAmc: can(role, 'amc.quote'),
    createSignals: can(role, 'signals.create'),
    createRepairs: can(role, 'repairs.create'),
    readMarketplace: can(role, 'marketplace.read'),
    readCerts: can(role, 'certs.read'),
    manageCerts: can(role, 'certs.manage'),
  };
}

function activityActions(access) {
  const actions = [...COMPANY_ACTIONS, ...SITE_ACTIONS];
  if (access.readPeople) actions.push(...PEOPLE_ACTIONS);
  if (access.readApiKeys) actions.push(...KEY_ACTIONS);
  return actions;
}

function sessionIsLive(row, now) {
  if (row.revoked_at) return false;
  return new Date(row.expires_at).getTime() > now;
}

function keyState(row, now) {
  if (row.revoked_at) return 'revoked';
  if (row.expires_at && new Date(row.expires_at).getTime() <= now) return 'expired';
  return 'active';
}

function buildNotices({ company, sites, user, includeSites }) {
  const notices = [];
  if (!company) {
    notices.push({
      id: 'company-missing',
      tone: 'warning',
      title: 'No company on this account',
      detail: 'Sites and people appear after the company is created.',
    });
    return notices;
  }
  if (company.status !== 'active') {
    notices.push({
      id: 'company-status',
      tone: 'warning',
      title: `Company is ${company.status}`,
      detail: 'Site changes stay blocked until the company is active again.',
    });
  }
  if (includeSites && sites.length === 0) {
    notices.push({
      id: 'sites-empty',
      tone: 'info',
      title: 'No sites yet',
      detail: 'Add a location when you are ready to track work by site.',
    });
  } else if (includeSites && !sites.some((site) => site.is_primary && site.status === 'active')) {
    notices.push({
      id: 'primary-missing',
      tone: 'info',
      title: 'No active primary site',
      detail: 'Choose one active site as the primary location.',
    });
  }
  const inactive = includeSites ? sites.filter((site) => site.status !== 'active').length : 0;
  if (inactive > 0) {
    notices.push({
      id: 'sites-inactive',
      tone: 'warning',
      title: inactive === 1 ? '1 site is not active' : `${inactive} sites are not active`,
      detail: 'Inactive sites stay on the roster and are not the working location.',
    });
  }
  if (user.email && !user.email_verified) {
    notices.push({
      id: 'email-unverified',
      tone: 'info',
      title: 'Email is not verified',
      detail: 'Confirm the address from the profile when a verification code arrives.',
    });
  }
  return notices;
}

function toCrewMember(row) {
  return {
    id: row.id,
    name: row.name || 'Unnamed',
    role: row.role,
    status: row.status || 'active',
    lastLoginAt: row.last_login_at || null,
  };
}

async function getDashboard(user, sessionId) {
  const access = accessFor(user.role);
  const now = Date.now();
  const companyRow = user.company_id && canAccessCompany(user, user.company_id)
    ? await companyModel.findById(user.company_id)
    : null;
  const company = companyRow && access.readCompany ? toPublicCompany(companyRow) : null;

  let siteRows = [];
  if (companyRow && access.readSites) {
    siteRows = await siteModel.listByCompany(companyRow.id);
  }

  let people = null;
  let peopleSummary = null;
  if (companyRow && access.readPeople) {
    const rows = await userModel.listByCompany(companyRow.id);
    people = rows.map(toCrewMember);
    const byRole = {};
    ROLE_NAMES.forEach((name) => {
      byRole[name] = 0;
    });
    rows.forEach((row) => {
      if (Object.prototype.hasOwnProperty.call(byRole, row.role)) byRole[row.role] += 1;
    });
    peopleSummary = {
      total: rows.length,
      active: rows.filter((row) => (row.status || 'active') === 'active').length,
      byRole,
    };
  }

  let sessions = null;
  if (access.readSessions) {
    const rows = await sessionModel.listByUser(user.id);
    const active = rows.filter((row) => sessionIsLive(row, now)).length;
    sessions = {
      active,
      current: rows.some((row) => row.id === sessionId && sessionIsLive(row, now)),
    };
  }

  let apiKeys = null;
  if (companyRow && access.readApiKeys) {
    const rows = await apiKeyModel.listByUser(user.id, companyRow.id);
    apiKeys = { active: 0, revoked: 0, expired: 0 };
    rows.forEach((row) => {
      apiKeys[keyState(row, now)] += 1;
    });
  }

  let activity = [];
  if (companyRow) {
    const rows = await auditModel.listRecentByCompany(companyRow.id, activityActions(access), 8);
    activity = rows.map((row) => ({
      id: row.id,
      action: row.action,
      title: row.description || row.action,
      detail: row.actor_name || '',
      at: row.created_at,
    }));
  }

  const activeSites = siteRows.filter((site) => site.status === 'active').length;
  const primary = siteRows.find((site) => site.is_primary);
  const operations = await fieldService.snapshot(user, access);

  return {
    generatedAt: new Date(now).toISOString(),
    access,
    company,
    summary: {
      sites: access.readSites ? {
        total: siteRows.length,
        active: activeSites,
        inactive: siteRows.length - activeSites,
        primaryName: primary ? primary.site_name : null,
      } : null,
      people: peopleSummary,
      sessions,
      apiKeys,
    },
    sites: siteRows.map(toPublicSite),
    people,
    activity,
    operations,
    notices: buildNotices({
      company: companyRow,
      sites: siteRows,
      user,
      includeSites: access.readSites,
    }),
  };
}

module.exports = {
  accessFor,
  getDashboard,
};
