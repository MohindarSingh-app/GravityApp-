import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiService } from '../services/api';

const STORAGE_KEY = '@energyhub/registration';

export interface RegistrationDraft {
  registrationId: string;
  mobile: string;
  email: string;
  currentStep: number;
  personalDetails?: any;
  professionalDetails?: any;
  bankDetails?: any;
  documents?: any[];
  serviceArea?: string;
  travelRadiusKm?: number;
}

interface RegistrationContextType {
  draft: RegistrationDraft | null;
  isReady: boolean;
  saveDraft: (draft: Partial<RegistrationDraft> & { registrationId: string }) => Promise<void>;
  loadDraft: () => Promise<RegistrationDraft | null>;
  clearDraft: () => Promise<void>;
}

const RegistrationContext = createContext<RegistrationContextType | undefined>(undefined);

export const RegistrationProvider = ({ children }: { children: React.ReactNode }) => {
  const [draft, setDraft] = useState<RegistrationDraft | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    loadDraft().finally(() => setIsReady(true));
  }, []);

  const loadDraft = useCallback(async (): Promise<RegistrationDraft | null> => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as RegistrationDraft;
      setDraft(parsed);
      return parsed;
    } catch (e) {
      console.warn('Failed to load registration draft:', e);
      return null;
    }
  }, []);

  const saveDraft = useCallback(
    async (partial: Partial<RegistrationDraft> & { registrationId: string }) => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        const existing: RegistrationDraft | null = raw ? JSON.parse(raw) : null;
        const merged: RegistrationDraft = {
          ...(existing || {}),
          ...partial,
        } as RegistrationDraft;
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
        setDraft(merged);
      } catch (e) {
        console.warn('Failed to save registration draft:', e);
      }
    },
    []
  );

  const clearDraft = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.warn('Failed to clear registration draft:', e);
    }
    setDraft(null);
  }, []);

  return (
    <RegistrationContext.Provider
      value={{ draft, isReady, saveDraft, loadDraft, clearDraft }}
    >
      {/* Do not mount consumers until the persisted draft has been read, so
          screens can safely seed their form state from `draft` on first render. */}
      {isReady ? children : null}
    </RegistrationContext.Provider>
  );
};

export const useRegistration = () => {
  const context = useContext(RegistrationContext);
  if (context === undefined) {
    throw new Error('useRegistration must be used within a RegistrationProvider');
  }
  return context;
};
