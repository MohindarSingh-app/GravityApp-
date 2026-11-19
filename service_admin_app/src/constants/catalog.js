import { cachedCatalog } from '../flows/useCatalog';

export const SITE_TYPES = [
  { value: 'factory', label: 'Factory' },
  { value: 'plant', label: 'Manufacturing / Production' },
  { value: 'warehouse', label: 'Warehouse / Storage' },
  { value: 'office', label: 'Office' },
  { value: 'other', label: 'Other' },
];

export function roleLabel(name) {
  const match = (cachedCatalog('account_role') || []).find((role) => role.code === name);
  if (match) return match.label;
  return name
    ? String(name).toLowerCase().split('_').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
    : 'Member';
}

export function canManageApiKeys(role) {
  return role === 'DIRECTOR_OWNER' || role === 'MAINTENANCE_HEAD';
}

export function canDeleteSites(role) {
  return role === 'DIRECTOR_OWNER' || role === 'MAINTENANCE_HEAD';
}

export function canUpdateJobs(role) {
  return role === 'DIRECTOR_OWNER' || role === 'MAINTENANCE_HEAD' || role === 'SITE_ENGINEER';
}

export function canQuoteAmc(role) {
  return role === 'DIRECTOR_OWNER' || role === 'MAINTENANCE_HEAD' || role === 'PURCHASE_MGR';
}

export function canUseMarketplace(role) {
  return canQuoteAmc(role);
}

export function canManageCerts(role) {
  return role === 'DIRECTOR_OWNER' || role === 'MAINTENANCE_HEAD';
}
