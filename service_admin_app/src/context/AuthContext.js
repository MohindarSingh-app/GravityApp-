import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { authApi } from '../api/auth.api';
import { refreshAccessToken, setSessionExpiredHandler } from '../api/client';
import { authService } from '../services/auth.service';
import { secureStorage } from '../storage/secureStorage';

export const AuthContext = createContext(null);

function clearAccountState(setters) {
  setters.setUser(null);
  setters.setCompany(null);
  setters.setOnboardingStatus(null);
  setters.setOnboarding(null);
  setters.setCelebrate(false);
  setters.setNewCompanyRegistration(false);
}

export function AuthProvider({ children }) {
  const [status, setStatus] = useState('loading');
  const [user, setUser] = useState(null);
  const [company, setCompany] = useState(null);
  const [onboardingStatus, setOnboardingStatus] = useState(null);
  const [onboarding, setOnboarding] = useState(null);
  const [bootError, setBootError] = useState('');
  const [celebrate, setCelebrate] = useState(false);
  const [postAuthRoute, setPostAuthRoute] = useState(null);
  const [newCompanyRegistration, setNewCompanyRegistration] = useState(false);

  const applyAccount = useCallback((data, extra = {}) => {
    if (!data) return;
    if (data.user) setUser(data.user);
    if (Object.prototype.hasOwnProperty.call(data, 'company')) {
      setCompany(data.company || null);
    }
    if (data.onboardingStatus) setOnboardingStatus(data.onboardingStatus);
    if (data.onboarding) setOnboarding(data.onboarding);
    if (extra.celebrate) setCelebrate(true);
  }, []);

  const restore = useCallback(async () => {
    setBootError('');
    setStatus('loading');
    try {
      const stored = await secureStorage.get();
      if (!stored || !stored.refreshToken) {
        clearAccountState({
          setUser, setCompany, setOnboardingStatus, setOnboarding, setCelebrate, setNewCompanyRegistration,
        });
        setStatus('unauthenticated');
        return;
      }
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        clearAccountState({
          setUser, setCompany, setOnboardingStatus, setOnboarding, setCelebrate, setNewCompanyRegistration,
        });
        setStatus('unauthenticated');
        return;
      }
      const data = await authApi.me();
      applyAccount(data);
      setStatus('authenticated');
    } catch (error) {
      if (error && error.code === 'NETWORK') {
        setBootError(error.message);
        setStatus('offline');
        return;
      }
      clearAccountState({
        setUser, setCompany, setOnboardingStatus, setOnboarding, setCelebrate, setNewCompanyRegistration,
      });
      setStatus('unauthenticated');
    }
  }, [applyAccount]);

  useEffect(() => {
    setSessionExpiredHandler(() => {
      clearAccountState({
        setUser, setCompany, setOnboardingStatus, setOnboarding, setCelebrate, setNewCompanyRegistration,
      });
      setStatus('unauthenticated');
    });
    restore();
    return () => setSessionExpiredHandler(null);
  }, [restore]);

  const enterSession = useCallback(async (data) => {
    applyAccount(data);
    setCelebrate(false);
    if (!Object.prototype.hasOwnProperty.call(data, 'company') || !data.onboarding) {
      try {
        applyAccount(await authApi.me());
      } catch (_error) {
        // The session is already stored. The next screen can reload account state.
      }
    }
    setStatus('authenticated');
    return data;
  }, [applyAccount]);

  const sendOtp = useCallback(async (body) => {
    return authService.sendOtp(body);
  }, []);

  const verifyOtp = useCallback(async (body, options = {}) => {
    const data = await authService.verifyOtp(body);
    setNewCompanyRegistration(Boolean(options.newCompanyRegistration));
    setPostAuthRoute(null);
    return enterSession(data);
  }, [enterSession]);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } finally {
      clearAccountState({
        setUser, setCompany, setOnboardingStatus, setOnboarding, setCelebrate, setNewCompanyRegistration,
      });
      setPostAuthRoute(null);
      setStatus('unauthenticated');
    }
  }, []);

  const logoutAll = useCallback(async () => {
    await authService.logoutAll();
    clearAccountState({
      setUser, setCompany, setOnboardingStatus, setOnboarding, setCelebrate, setNewCompanyRegistration,
    });
    setPostAuthRoute(null);
    setStatus('unauthenticated');
  }, []);

  const refreshAccount = useCallback(async (extra = {}) => {
    const data = await authApi.me();
    const celebrateNow = Boolean(extra.celebrate)
      || (extra.celebrateOnComplete && data.onboardingStatus === 'ONBOARDING_COMPLETED');
    applyAccount(data, { celebrate: celebrateNow });
    return data;
  }, [applyAccount]);

  const updateProfile = useCallback(async (fullName) => {
    const data = await authService.updateProfile(fullName);
    if (data && data.user) setUser(data.user);
    return data.user;
  }, []);

  const verifyEmail = useCallback(async (token) => {
    const data = await authService.verifyEmail(token);
    if (data && data.user) setUser(data.user);
    return data.user;
  }, []);

  const dismissCelebration = useCallback(() => {
    setCelebrate(false);
    setNewCompanyRegistration(false);
  }, []);

  const value = useMemo(() => ({
    status,
    user,
    company,
    onboardingStatus,
    onboarding,
    bootError,
    celebrate,
    newCompanyRegistration,
    postAuthRoute,
    retry: restore,
    sendOtp,
    verifyOtp,
    logout,
    logoutAll,
    refreshAccount,
    updateProfile,
    verifyEmail,
    dismissCelebration,
    resendVerification: authService.resendVerification,
    adminOverview: authService.adminOverview,
  }), [
    status,
    user,
    company,
    onboardingStatus,
    onboarding,
    bootError,
    celebrate,
    newCompanyRegistration,
    postAuthRoute,
    restore,
    sendOtp,
    verifyOtp,
    logout,
    logoutAll,
    refreshAccount,
    updateProfile,
    verifyEmail,
    dismissCelebration,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
