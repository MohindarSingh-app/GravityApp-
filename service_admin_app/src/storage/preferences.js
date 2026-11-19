import { Platform } from 'react-native';
import * as Keychain from 'react-native-keychain';

const SERVICE = 'com.service_admin_app.preferences';

const DEFAULTS = {
  scheme: 'light',
  deviceId: null,
};

function deviceName() {
  if (Platform.OS === 'android') {
    const brand = Platform.constants && Platform.constants.Brand;
    const model = Platform.constants && Platform.constants.Model;
    return [brand, model].filter(Boolean).join(' ') || 'Android device';
  }
  return 'iOS device';
}

function createDeviceId() {
  return `app_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

async function read() {
  try {
    const credentials = await Keychain.getGenericPassword({ service: SERVICE });
    if (!credentials) return { ...DEFAULTS };
    const parsed = JSON.parse(credentials.password);
    return {
      scheme: parsed.scheme === 'dark' ? 'dark' : DEFAULTS.scheme,
      deviceId: parsed.deviceId || null,
    };
  } catch (_error) {
    return { ...DEFAULTS };
  }
}

async function write(value) {
  const saved = await Keychain.setGenericPassword(SERVICE, JSON.stringify(value), {
    service: SERVICE,
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  if (!saved) throw new Error('Unable to save app preferences securely.');
}

async function update(partial) {
  const next = { ...(await read()), ...partial };
  await write(next);
  return next;
}

export async function getDeviceMeta() {
  const current = await read();
  const deviceId = current.deviceId || createDeviceId();
  if (!current.deviceId) {
    await update({ deviceId });
  }
  return { deviceId, deviceName: deviceName().slice(0, 120) };
}

export const preferences = { read, update };
