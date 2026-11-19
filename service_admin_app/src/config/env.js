import { Platform } from 'react-native';
import Config from 'react-native-config';

function androidEmulator() {
  if (Platform.OS !== 'android') return false;
  const details = Platform.constants || {};
  const blob = `${details.Fingerprint || ''} ${details.Model || ''} ${details.Brand || ''}`;
  return /generic|emulator|sdk_gphone|google_sdk|android sdk built for|goldfish|ranchu/i.test(blob);
}

function devApiBaseUrl() {
  const configured = Config.EXPO_PUBLIC_API_URL;
  if (Platform.OS === 'web') {
    return (configured || 'http://192.168.1.2:3000').replace(/\/$/, '');
  }
  const emulator = androidEmulator();
  if (Config.EXPO_PUBLIC_USE_ADB_REVERSE === '1' && Platform.OS === 'android') {
    if (!configured) return 'http://127.0.0.1:3000';
    try {
      const url = new URL(configured);
      const localName = url.hostname === 'localhost'
        || url.hostname === '127.0.0.1'
        || url.hostname === '0.0.0.0'
        || /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(url.hostname);
      if (localName) url.hostname = '127.0.0.1';
      return url.origin;
    } catch (_error) {
      return 'http://127.0.0.1:3000';
    }
  }
  if (configured) {
    try {
      const url = new URL(configured);
      const localName = url.hostname === 'localhost'
        || url.hostname === '127.0.0.1'
        || url.hostname === '0.0.0.0'
        || url.hostname === '::1';
      if (localName && emulator) {
        url.hostname = '10.0.2.2';
      } else if (localName && Platform.OS === 'android') {
        throw new Error(
          'Set EXPO_PUBLIC_API_URL to the backend computer’s Wi-Fi IP address for a physical Android device.',
        );
      }
      return url.origin;
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Set EXPO_PUBLIC_API_URL')) {
        throw error;
      }
      return configured.replace(/\/$/, '');
    }
  }
  if (emulator) return 'http://10.0.2.2:3000';
  if (Platform.OS === 'android') {
    throw new Error('Set EXPO_PUBLIC_API_URL to the backend computer’s Wi-Fi IP address for Android.');
  }
  return 'http://192.168.1.2:3000';
}

const DEV_API_BASE_URL = devApiBaseUrl();
const PROD_API_BASE_URL = Config.EXPO_PUBLIC_API_URL || '';

function resolveApiBaseUrl() {
  const url = __DEV__ ? DEV_API_BASE_URL : PROD_API_BASE_URL;
  if (!url) {
    throw new Error('EXPO_PUBLIC_API_URL must be set when building for production.');
  }
  if (!__DEV__ && !url.startsWith('https://')) {
    throw new Error('Production API URL must use HTTPS.');
  }
  return url.replace(/\/$/, '');
}

export const config = {
  apiBaseUrl: resolveApiBaseUrl(),
  isDev: __DEV__,
};
