import { request } from './client';

export const authApi = {
  sendOtp: (body) => request('/api/auth/send-otp', { method: 'POST', body, auth: false }),
  verifyOtp: (body) => request('/api/auth/verify-otp', { method: 'POST', body, auth: false }),
  logout: (refreshToken) => request('/api/auth/logout', {
    method: 'POST',
    body: { refreshToken },
    auth: false,
  }),
  logoutAll: () => request('/api/auth/logout-all', { method: 'POST' }),
  me: () => request('/api/auth/me'),
  updateProfile: (fullName) => request('/api/auth/profile', {
    method: 'PATCH',
    body: { fullName },
  }),
  verifyEmail: (token) => request('/api/auth/verify-email', {
    method: 'POST',
    body: { token },
  }),
  resendVerification: () => request('/api/auth/resend-verification', { method: 'POST' }),
  adminOverview: () => request('/api/admin/overview'),
};
