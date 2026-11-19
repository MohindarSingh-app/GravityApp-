import * as Keychain from 'react-native-keychain';

const SERVICE = 'com.gravityhub.serviceadmin.auth';
// Rebrand se pehle purane bundle-id par save session in legacy keys me hai.
// Naye install/upgrade par purana token recover karke naye key par migrate karte hain.
const LEGACY_KEYS = [
  'com.zypli.serviceadmin.auth',
  'com.zypli-service-admin.auth',
];

async function write(value) {
  const saved = await Keychain.setGenericPassword(SERVICE, value, {
    service: SERVICE,
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  if (!saved) throw new Error('Unable to save the secure session.');
}

async function save({ accessToken, refreshToken }) {
  await write(JSON.stringify({ accessToken, refreshToken }));
}

async function readKey(key) {
  try {
    const credentials = await Keychain.getGenericPassword({ service: key });
    if (!credentials) return null;
    const parsed = JSON.parse(credentials.password);
    if (!parsed || !parsed.refreshToken) return null;
    return {
      accessToken: parsed.accessToken || null,
      refreshToken: parsed.refreshToken,
    };
  } catch (_error) {
    return null;
  }
}

async function get() {
  const current = await readKey(SERVICE);
  if (current) return current;

  // Naye key par kuch nahi mila — legacy keys se recover + migrate karte hain.
  for (const legacy of LEGACY_KEYS) {
    const migrated = await readKey(legacy);
    if (migrated) {
      await write(JSON.stringify(migrated)).catch(() => {});
      await Keychain.resetGenericPassword({ service: legacy }).catch(() => {});
      return migrated;
    }
  }
  return null;
}

async function clear() {
  await Keychain.resetGenericPassword({ service: SERVICE });
  await Promise.all(LEGACY_KEYS.map((key) => Keychain.resetGenericPassword({ service: key }).catch(() => {})));
}

export const secureStorage = { save, get, clear };
