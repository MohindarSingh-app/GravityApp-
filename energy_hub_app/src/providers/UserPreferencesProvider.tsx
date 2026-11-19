import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AppearanceMode,
  applyActiveColors,
  ColorPalette,
  createThemeColors,
  isColorPalette,
  ThemeColors,
} from '../components/theme';

export type { AppearanceMode, ColorPalette };

const STORAGE_KEY = 'energyHub.userPreferences';

interface UserPreferences {
  appearance: AppearanceMode;
  palette: ColorPalette;
  avatarUri: string | null;
}

interface UserPreferencesContextValue extends UserPreferences {
  ready: boolean;
  colors: ThemeColors;
  setAppearance: (appearance: AppearanceMode) => Promise<void>;
  setPalette: (palette: ColorPalette) => Promise<void>;
  setAvatarUri: (uri: string | null) => Promise<void>;
}

const defaults: UserPreferences = {
  appearance: 'light',
  palette: 'ocean',
  avatarUri: null,
};

const UserPreferencesContext = createContext<UserPreferencesContextValue | null>(null);

export const UserPreferencesProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [preferences, setPreferences] = useState(defaults);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (!stored) return;
        const parsed = JSON.parse(stored) as Partial<UserPreferences>;
        setPreferences({
          appearance: parsed.appearance === 'dark' ? 'dark' : 'light',
          palette: isColorPalette(parsed.palette) ? parsed.palette : 'ocean',
          avatarUri: typeof parsed.avatarUri === 'string' ? parsed.avatarUri : null,
        });
      })
      .catch((error) => {
        console.error('Could not load user preferences.', error);
      })
      .finally(() => setReady(true));
  }, []);

  const updatePreference = useCallback(async (next: UserPreferences) => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setPreferences(next);
  }, []);

  const setAppearance = useCallback((appearance: AppearanceMode) => (
    updatePreference({ ...preferences, appearance })
  ), [preferences, updatePreference]);

  const setPalette = useCallback((palette: ColorPalette) => (
    updatePreference({ ...preferences, palette })
  ), [preferences, updatePreference]);

  const setAvatarUri = useCallback((avatarUri: string | null) => (
    updatePreference({ ...preferences, avatarUri })
  ), [preferences, updatePreference]);

  const colors = useMemo(
    () => createThemeColors(preferences.appearance, preferences.palette),
    [preferences.appearance, preferences.palette],
  );
  applyActiveColors(colors);

  const value = useMemo(() => ({
    ...preferences,
    ready,
    colors,
    setAppearance,
    setPalette,
    setAvatarUri,
  }), [preferences, ready, colors, setAppearance, setPalette, setAvatarUri]);

  return <UserPreferencesContext.Provider value={value}>{children}</UserPreferencesContext.Provider>;
};

export const useUserPreferences = (): UserPreferencesContextValue => {
  const context = useContext(UserPreferencesContext);
  if (!context) throw new Error('useUserPreferences must be used within UserPreferencesProvider.');
  return context;
};
