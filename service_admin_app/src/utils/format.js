export function formatWhen(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatCoordinate(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '';
  return number.toFixed(5);
}

export function buildActivity({ company, sites, sessions, user }) {
  const items = [];
  if (company && company.createdAt) {
    items.push({
      id: `company-${company.id}`,
      at: company.createdAt,
      title: 'Company created',
      detail: company.companyName,
    });
  }
  (sites || []).forEach((site) => {
    if (!site.createdAt) return;
    items.push({
      id: `site-${site.id}`,
      at: site.createdAt,
      title: 'Site added',
      detail: site.siteName,
    });
  });
  (sessions || []).filter((session) => !session.revoked).slice(0, 3).forEach((session) => {
    items.push({
      id: `session-${session.id}`,
      at: session.lastUsedAt || session.createdAt,
      title: session.current ? 'This device is active' : 'Another session is active',
      detail: session.deviceName || 'Signed-in device',
    });
  });
  if (user && user.lastLoginAt) {
    items.push({
      id: 'last-login',
      at: user.lastLoginAt,
      title: 'Last sign-in',
      detail: user.phone || user.email || 'Account',
    });
  }
  return items
    .filter((item) => item.at)
    .sort((a, b) => new Date(b.at) - new Date(a.at))
    .slice(0, 6);
}
