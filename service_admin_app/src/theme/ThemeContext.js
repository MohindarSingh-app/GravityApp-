import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { preferences } from '../storage/preferences';
import {
  createColors, createType, motion, radius, space,
} from './tokens';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [scheme, setSchemeState] = useState('light');
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let active = true;
    preferences.read().then((stored) => {
      if (!active) return;
      setSchemeState(stored.scheme);
    }).catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    if (typeof AccessibilityInfo.isReduceMotionEnabled === 'function') {
      Promise.resolve(AccessibilityInfo.isReduceMotionEnabled()).then((enabled) => {
        if (active) setReduceMotion(Boolean(enabled));
      }).catch(() => {});
    }
    const subscription = typeof AccessibilityInfo.addEventListener === 'function'
      ? AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
        setReduceMotion(Boolean(enabled));
      })
      : null;
    return () => {
      active = false;
      if (subscription && typeof subscription.remove === 'function') subscription.remove();
    };
  }, []);

  const setScheme = useCallback(async (mode) => {
    const next = mode === 'dark' ? 'dark' : 'light';
    setSchemeState(next);
    await preferences.update({ scheme: next });
  }, []);

  const value = useMemo(() => {
    const colors = createColors(scheme);
    return {
      colors,
      type: createType(colors),
      space,
      radius,
      motion,
      scheme,
      reduceMotion,
      setScheme,
    };
  }, [reduceMotion, scheme, setScheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) {
    throw new Error('useTheme must be used within ThemeProvider.');
  }
  return value;
}
