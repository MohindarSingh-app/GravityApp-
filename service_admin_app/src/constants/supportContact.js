import { Linking } from 'react-native';
import Config from 'react-native-config';

export const DEFAULT_SUPPORT_PHONE = '+919983498888';

export function supportPhoneFromEnv() {
  const fromEnv = String(Config.EXPO_PUBLIC_SUPPORT_PHONE || '').replace(/[^\d+]/g, '');
  return fromEnv || DEFAULT_SUPPORT_PHONE;
}

export async function dialPhone(rawPhone) {
  const phone = String(rawPhone || '').replace(/[^\d+]/g, '');
  if (!phone) throw new Error('Call number is not available.');
  const url = `tel:${phone}`;
  const can = await Linking.canOpenURL(url);
  if (!can) throw new Error('Phone dialer is not available on this device.');
  await Linking.openURL(url);
}
