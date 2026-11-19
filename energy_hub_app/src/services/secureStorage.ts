import * as Keychain from 'react-native-keychain';

const serviceFor = (key: string) => `com.energyhub.partner.${key}`;

export const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    const result = await Keychain.getGenericPassword({ service: serviceFor(key) });
    return result ? result.password : null;
  },

  async setItem(key: string, value: string): Promise<void> {
    const saved = await Keychain.setGenericPassword(key, value, { service: serviceFor(key) });
    if (!saved) throw new Error(`Could not securely save ${key}.`);
  },

  async removeItem(key: string): Promise<void> {
    await Keychain.resetGenericPassword({ service: serviceFor(key) });
  },
};
