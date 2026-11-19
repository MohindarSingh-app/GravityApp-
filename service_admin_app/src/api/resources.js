import { request } from './client';

export const companyApi = {
  create: (body) => request('/api/companies', { method: 'POST', body }),
  mine: () => request('/api/companies/mine'),
  get: (id) => request(`/api/companies/${id}`),
  select: (id) => request(`/api/companies/${id}/select`, { method: 'POST', body: {} }),
  update: (id, body) => request(`/api/companies/${id}`, { method: 'PATCH', body }),
};

export const siteApi = {
  list: (companyId) => request(`/api/companies/${companyId}/sites`),
  create: (companyId, body) => request(`/api/companies/${companyId}/sites`, { method: 'POST', body }),
  update: (id, body) => request(`/api/sites/${id}`, { method: 'PATCH', body }),
  remove: (id) => request(`/api/sites/${id}`, { method: 'DELETE' }),
  setPrimary: (id) => request(`/api/sites/${id}/primary`, { method: 'PATCH' }),
};

export const profileApi = {
  get: () => request('/api/profile'),
  create: (body) => request('/api/profile', { method: 'POST', body }),
  update: (body) => request('/api/profile', { method: 'PATCH', body }),
  avatar: (body) => request('/api/profile/avatar', { method: 'POST', body }),
};

export const apiKeyApi = {
  list: () => request('/api/api-keys'),
  create: (body) => request('/api/api-keys', { method: 'POST', body }),
  revoke: (id) => request(`/api/api-keys/${id}/revoke`, { method: 'POST' }),
  rotate: (id) => request(`/api/api-keys/${id}/rotate`, { method: 'POST' }),
};

export const sessionApi = {
  list: () => request('/api/auth/sessions'),
  revoke: (id) => request(`/api/auth/sessions/${id}/revoke`, { method: 'POST' }),
};

export const notificationApi = {
  list: () => request('/api/notifications'),
  markRead: (id) => request(`/api/notifications/${id}/read`, { method: 'POST', body: {} }),
};

export const supportApi = {
  create: (body) => request('/api/support', { method: 'POST', body }),
  assist: (body) => request('/api/support/assist', { method: 'POST', body }),
};

export const marketplaceApi = {
  catalog: (params = {}) => request(`/api/marketplace/products${query(params)}`),
  product: (id) => request(`/api/marketplace/products/${id}`),
  cart: () => request('/api/marketplace/cart'),
  addToCart: (body) => request('/api/marketplace/cart/items', { method: 'POST', body }),
  setCartItemQuantity: (productId, quantity) => request(`/api/marketplace/cart/items/${productId}`, {
    method: 'PUT',
    body: { quantity },
  }),
  checkout: (body) => request('/api/marketplace/checkout', { method: 'POST', body }),
  orders: () => request('/api/marketplace/orders'),
  order: (id) => request(`/api/marketplace/orders/${id}`),
};

export const roleApi = {
  list: () => request('/api/roles'),
};

export const userApi = {
  setRole: (id, roleId) => request(`/api/users/${id}/role`, { method: 'PATCH', body: { roleId } }),
};

export const catalogApi = {
  groups: (groups) => request(`/api/catalog?groups=${encodeURIComponent(groups.join(','))}`),
  addManufacturer: (name) => request('/api/catalog/manufacturers', { method: 'POST', body: { name } }),
};

export const dashboardApi = {
  get: () => request('/api/dashboard'),
};

function query(params) {
  const search = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  });
  const text = search.toString();
  return text ? `?${text}` : '';
}

export const fieldApi = {
  jobs: () => request('/api/field/jobs'),
  job: (id) => request(`/api/field/jobs/${id}`),
  createJob: (body) => request('/api/field/jobs', { method: 'POST', body }),
  setJobStatus: (id, body) => request(`/api/field/jobs/${id}/status`, { method: 'PATCH', body }),
  signals: (kind) => request(kind ? `/api/field/signals?kind=${encodeURIComponent(kind)}` : '/api/field/signals'),
  createSignal: (body) => request('/api/field/signals', { method: 'POST', body }),
  catalog: () => request('/api/field/catalog'),
  products: () => request('/api/field/products'),
  amc: () => request('/api/field/amc'),
  createAmc: (body) => request('/api/field/amc', { method: 'POST', body }),
  certs: () => request('/api/field/certs'),
  createCert: (body) => request('/api/field/certs', { method: 'POST', body }),
};

export const customerApi = {
  uploadAttachment: (body) => request('/api/customer/attachments', { method: 'POST', body }),
  contracts: () => request(`/api/customer/amc/contracts${query({ limit: 50 })}`),
  contract: (id) => request(`/api/customer/amc/contracts/${id}`),
  amcRequests: (contractId) => request(`/api/customer/amc/requests${query({ contractId, limit: 50 })}`),
  createAmcRequest: (body) => request('/api/customer/amc/requests', { method: 'POST', body }),
  createReschedule: (body) => request('/api/customer/amc/reschedules', { method: 'POST', body }),
  devices: () => request(`/api/customer/repairs/devices${query({ limit: 50 })}`),
  device: (id) => request(`/api/customer/repairs/devices/${id}`),
  createDevice: (body) => request('/api/customer/repairs/devices', { method: 'POST', body }),
  repairTickets: (params = {}) => request(`/api/customer/repairs/tickets${query({ limit: 50, ...params })}`),
  repairTicket: (id) => request(`/api/customer/repairs/tickets/${id}`),
  createTicket: (body) => request('/api/customer/repairs/tickets', { method: 'POST', body }),
  projectCategories: () => request('/api/customer/projects/categories'),
  createProject: (body) => request('/api/customer/projects/requests', { method: 'POST', body }),
  serviceCategories: () => request('/api/customer/service-categories'),
  serviceCategory: (categoryId) => request(`/api/customer/service-categories/${categoryId}/services`),
  createServiceRequest: (body) => request('/api/customer/service-requests', { method: 'POST', body }),
  serviceRequest: (id) => request(`/api/customer/service-requests/${id}`),
};
