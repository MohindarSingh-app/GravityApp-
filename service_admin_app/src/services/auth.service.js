import { authApi } from '../api/auth.api';
import { setAccessToken } from '../api/client';
import { getDeviceMeta } from '../storage/preferences';
import { secureStorage } from '../storage/secureStorage';

async function withDevice(body) {
  try {
    const device = await getDeviceMeta();
    return { ...device, ...body };
  } catch (_error) {
    return body;
  }
}

async function persist(data) {
  setAccessToken(data.accessToken);
  await secureStorage.save({
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
  });
  return data;
}

async function clearLocalSession() {
  setAccessToken(null);
  await secureStorage.clear();
}

export const authService = {
  sendOtp(body) {
    return authApi.sendOtp(body);
  },
  async verifyOtp(body) {
    const data = await authApi.verifyOtp(await withDevice(body));
    return data && data.approvalRequired ? data : persist(data);
  },
  async logout() {
    const stored = await secureStorage.get();
    try {
      if (stored && stored.refreshToken) {
        await authApi.logout(stored.refreshToken);
      }
    } finally {
      await clearLocalSession();
    }
  },
  async logoutAll() {
    await authApi.logoutAll();
    await clearLocalSession();
  },
  updateProfile: authApi.updateProfile,
  verifyEmail: authApi.verifyEmail,
  resendVerification: authApi.resendVerification,
  adminOverview: authApi.adminOverview,
};
