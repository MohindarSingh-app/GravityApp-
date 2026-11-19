import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { secureStorage } from '../services/secureStorage';
import { apiService } from '../services/api';
import { AuthUser, ApplicationStatus, UserRole } from '../types';

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  previewRole: UserRole | null;
  setPreviewRole: (role: UserRole | null) => void;
  login: (token: string, user: AuthUser) => Promise<void>;
  logout: () => Promise<void>;
  restoreSession: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [previewRole, setPreviewRole] = useState<UserRole | null>(null);

  useEffect(() => {
    void restoreSession();
  }, []);

  const restoreSession = useCallback(async () => {
    try {
      // These independent secure-storage reads can run together, avoiding
      // three sequential native bridge round trips on every cold launch.
      const [token, refreshToken, userStr] = await Promise.all([
        secureStorage.getItem('token'),
        secureStorage.getItem('refreshToken'),
        secureStorage.getItem('user'),
      ]);

      if (token && refreshToken && userStr) {
        const parsedUser: AuthUser = JSON.parse(userStr);
        await apiService.setToken(token);
        setUser({ ...parsedUser, token, refreshToken });
      }
    } catch (error) {
      console.error('Session restore failed:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = useCallback(async (token: string, userData: AuthUser) => {
    setPreviewRole(null);
    await apiService.setToken(token);
    await secureStorage.setItem('refreshToken', userData.refreshToken || '');
    await secureStorage.setItem('user', JSON.stringify(userData));
    setUser({ ...userData, token });
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiService.logout();
    } catch (e) {
      // ignore
    }
    await secureStorage.removeItem('token');
    await secureStorage.removeItem('refreshToken');
    await secureStorage.removeItem('user');
    setUser(null);
    setPreviewRole(null);
  }, []);

  const isAuthenticated = !!user;

  return (
    <AuthContext.Provider value={{ user, isLoading, isAuthenticated, previewRole, setPreviewRole, login, logout, restoreSession }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};