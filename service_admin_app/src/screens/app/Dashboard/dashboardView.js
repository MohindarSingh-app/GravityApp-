import { roleLabel } from '../../../constants/catalog';

export function formatStatus(status) {
  if (!status) return '';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function roleMix(byRole) {
  if (!byRole) return '';
  return ['DIRECTOR_OWNER', 'MAINTENANCE_HEAD', 'PURCHASE_MGR', 'SITE_ENGINEER']
    .filter((role) => byRole[role] > 0)
    .map((role) => `${byRole[role]} ${roleLabel(role)}`)
    .join(' · ');
}

export function siteMix(sites) {
  const counts = {};
  (sites || []).forEach((site) => {
    const label = site.siteTypeLabel || site.siteType || 'Site';
    counts[label] = (counts[label] || 0) + 1;
  });
  return Object.keys(counts)
    .map((label) => `${counts[label]} ${label}`)
    .join(' · ');
}

export function metricRows(summary = {}, access = {}) {
  const rows = [];
  if (summary.sites) {
    const primary = summary.sites.primaryName
      ? `Primary ${summary.sites.primaryName}`
      : 'No primary site';
    rows.push({
      id: 'sites',
      label: 'Active sites',
      value: String(summary.sites.active),
      hint: summary.sites.total === 0
        ? 'None on the roster'
        : `${summary.sites.total} on the roster · ${primary}`,
    });
  }
  if (access.readPeople && summary.people) {
    rows.push({
      id: 'people',
      label: 'People',
      value: String(summary.people.active),
      hint: roleMix(summary.people.byRole) || 'No accounts',
    });
  }
  if (summary.sessions) {
    rows.push({
      id: 'sessions',
      label: 'Live sessions',
      value: String(summary.sessions.active),
      hint: summary.sessions.current ? 'This device is included' : 'This device is not in the count',
    });
  }
  if (access.readApiKeys && summary.apiKeys) {
    const closed = [];
    if (summary.apiKeys.revoked) closed.push(`${summary.apiKeys.revoked} revoked`);
    if (summary.apiKeys.expired) closed.push(`${summary.apiKeys.expired} expired`);
    rows.push({
      id: 'keys',
      label: 'API keys',
      value: String(summary.apiKeys.active),
      hint: closed.length ? closed.join(' · ') : 'None closed',
    });
  }
  return rows;
}

export function dashboardCommands(access = {}) {
  const commands = [];
  if (access.updateCompany) {
    commands.push({
      id: 'company',
      route: 'Company',
      label: 'Company record',
      detail: 'Name, GSTIN, and city',
    });
  }
  if (access.readSites) {
    commands.push({
      id: 'sites',
      route: 'SitesList',
      label: access.createSites ? 'Sites' : 'Site roster',
      detail: access.updateSites ? 'Add or update locations' : 'Review locations',
    });
  }
  commands.push(
    { id: 'security', route: 'Security', label: 'Security', detail: 'Sign out of this device' },
  );
  if (access.readSessions) {
    commands.push({
      id: 'sessions',
      route: 'Sessions',
      label: 'Sessions',
      detail: 'Devices signed in',
    });
  }
  if (access.readApiKeys) {
    commands.push({
      id: 'keys',
      route: 'APIKeys',
      label: 'API keys',
      detail: 'Create and revoke',
    });
  }
  return commands;
}

export function operationMetrics(operations) {
  const metrics = operations && operations.metrics;
  if (!metrics) return [];
  return [
    { id: 'jobs', label: 'Active jobs', value: String(metrics.activeJobs), tone: 'transit' },
    { id: 'sla', label: 'SLA risk', value: String(metrics.slaRisk), tone: 'emergency' },
    { id: 'amc', label: 'AMC active', value: String(metrics.amcActive), tone: 'amc' },
    { id: 'certs', label: 'Cert expiring', value: String(metrics.certsExpiring), tone: 'cert' },
  ];
}

const DOCK_ROUTES = new Set(['Emergency', 'QuickServices', 'Jobs', 'Amc']);

export function boardLinks(access = {}) {
  const links = fieldMoves(access).filter((item) => !DOCK_ROUTES.has(item.route));
  if (access.createRepairs) {
    links.push({
      id: 'repair',
      route: 'RepairCenter',
      label: 'Repair center',
      detail: 'Register a device and open a ticket',
      tone: 'repair',
    });
  }
  links.push({
    id: 'expert',
    route: 'Expert',
    label: 'Talk to an expert',
    detail: 'Request a call before you book',
    tone: 'project',
  });
  return links;
}

export function fieldMoves(access = {}) {
  const moves = [
    { id: 'emergency', route: 'Emergency', label: 'Emergency', detail: 'Machine down, call a technician', tone: 'emergency' },
    { id: 'services', route: 'QuickServices', label: 'Quick services', detail: 'Request a service visit and track its status', tone: 'transit' },
    { id: 'projects', route: 'Projects', label: 'Projects', detail: 'New installation', tone: 'project' },
  ];
  if (access.readMarketplace) {
    moves.push({ id: 'market', route: 'Marketplace', label: 'Marketplace', detail: 'Spares for the plant', tone: 'market' });
  }
  if (access.readCerts) {
    moves.push({ id: 'certs', route: 'Compliance', label: 'Compliance', detail: 'Certificates on this company', tone: 'cert' });
  }
  moves.push({ id: 'jobs', route: 'Jobs', label: 'Jobs', detail: 'Open work and SLA', tone: 'repair' });
  if (access.readAmc) {
    moves.push({ id: 'amc', route: 'Amc', label: 'AMC', detail: 'Cover and quotes', tone: 'amc' });
  }
  return moves;
}

export function boardSearch(operations, query) {
  const needle = String(query || '').trim().toLowerCase();
  const jobs = (operations && operations.jobs) || [];
  const services = (operations && operations.services) || [];
  if (!needle) return { jobs, services: [] };
  return {
    jobs: jobs.filter((job) => `${job.title} ${job.code} ${job.location} ${job.engineerName}`.toLowerCase().includes(needle)),
    services: services.filter((item) => `${item.name} ${item.summary}`.toLowerCase().includes(needle)),
  };
}

export function jobStatusLabel(status) {
  const labels = {
    open: 'Open',
    accepted: 'Accepted',
    on_the_way: 'On the way',
    in_progress: 'In progress',
    completed: 'Done',
    cancelled: 'Cancelled',
  };
  return labels[status] || formatStatus(status);
}
