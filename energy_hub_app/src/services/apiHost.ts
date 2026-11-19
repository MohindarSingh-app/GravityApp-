const DEFAULT_BACKEND_PORT = 3000;
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '0.0.0.0']);
const PRIVATE_LAN = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/;

const isLoopback = (host?: string | null) => !host || LOOPBACK_HOSTS.has(host);

export const isAndroidEmulator = (details = '') => (
  /generic|emulator|sdk_gphone|google_sdk|android sdk built for|goldfish|ranchu/i.test(details)
);

const getMetroHost = (bundleUrl?: string) => {
  if (!bundleUrl) return null;
  try {
    return new URL(bundleUrl).hostname;
  } catch {
    return null;
  }
};

export const isMetroLoopback = (bundleUrl?: string) => {
  const host = getMetroHost(bundleUrl);
  return !host || LOOPBACK_HOSTS.has(host);
};

export const resolveApiHost = (
  configuredApiUrl: string | undefined,
  platform: string,
  bundleUrl?: string,
  preserveAndroidLoopback = false,
  isEmulator = false,
) => {
  const metroHost = getMetroHost(bundleUrl);
  const localDeviceHost = platform === 'android'
    ? metroHost && !LOOPBACK_HOSTS.has(metroHost) ? metroHost : '10.0.2.2'
    : metroHost;

  if (configuredApiUrl) {
    const configuredUrl = new URL(configuredApiUrl);
    // On real devices, localhost points to the phone. Use ADB reverse or the Metro host instead.
    const configuredIsLocal = isLoopback(configuredUrl.hostname) || PRIVATE_LAN.test(configuredUrl.hostname);
    if (configuredIsLocal && platform !== 'web' && !preserveAndroidLoopback) {
      if (platform === 'android') {
        // A phone can reach the Metro host over Wi-Fi. An emulator uses the Android host alias.
        configuredUrl.hostname = isEmulator || isLoopback(metroHost)
          ? '10.0.2.2'
          : (metroHost || configuredUrl.hostname);
      } else if (metroHost) {
        configuredUrl.hostname = metroHost;
      }
    }
    return configuredUrl.origin;
  }

  const defaultHost = platform === 'android'
    ? localDeviceHost || '10.0.2.2'
    : platform !== 'web' && metroHost
    ? metroHost
      : 'localhost';
  return `http://${defaultHost}:${DEFAULT_BACKEND_PORT}`;
};
