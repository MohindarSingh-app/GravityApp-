import { config } from '../config/env';
import { getDeviceMeta } from '../storage/preferences';
import { secureStorage } from '../storage/secureStorage';
import { ApiError } from '../utils/errors';
import { getMockForPath } from './mockData';
import Config from 'react-native-config';

let accessToken = null;
let refreshPromise = null;
let sessionExpiredHandler = null;

const DEBUG = __DEV__;

// Fallback URLs agar primary server na chale (comma separated .env se).
const FALLBACK_URLS = (Config.EXPO_PUBLIC_API_FALLBACK_URLS || '')
  .split(',')
  .map((u) => u.trim())
  .filter(Boolean);

function apiLog(method, url, status, body) {
  if (!DEBUG) return;
  try {
    console.log(`[API] ${method} ${url} -> ${status || 'NETWORK_ERROR'}`, body ? { body } : '');
  } catch (_e) {
    // ignore logging errors
  }
}

const SKIP_REFRESH = new Set([
  '/api/auth/refresh',
  '/api/auth/logout',
  '/api/auth/send-otp',
  '/api/auth/verify-otp',
]);

export function setAccessToken(token) {
  accessToken = token || null;
}

export function getAccessToken() {
  return accessToken;
}

export function setSessionExpiredHandler(handler) {
  sessionExpiredHandler = handler;
}

function buildHeaders(auth) {
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  if (auth && accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  return headers;
}

async function parseBody(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (_error) {
    throw new ApiError('The server returned an unexpected response.', response.status, 'BAD_RESPONSE');
  }
}

async function deviceBody(refreshToken) {
  const body = { refreshToken };
  try {
    const device = await getDeviceMeta();
    if (device.deviceId) body.deviceId = device.deviceId;
    if (device.deviceName) body.deviceName = device.deviceName;
  } catch (_error) {
    return body;
  }
  return body;
}

async function performRefresh() {
  const stored = await secureStorage.get();
  if (!stored || !stored.refreshToken) return false;

  let response;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      response = await fetch(`${config.apiBaseUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: buildHeaders(false),
        body: JSON.stringify(await deviceBody(stored.refreshToken)),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  } catch (_error) {
    throw new ApiError(
      'Unable to reach the server. Check your connection and try again.',
      0,
      'NETWORK',
    );
  }

  const payload = await parseBody(response);
  if (!response.ok || !payload || payload.success === false) {
    accessToken = null;
    await secureStorage.clear();
    return false;
  }

  accessToken = payload.data.accessToken;
  await secureStorage.save({
    accessToken: payload.data.accessToken,
    refreshToken: payload.data.refreshToken,
  });
  return payload.data;
}

export function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = performRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

export async function request(path, options = {}) {
  const {
    method = 'GET',
    body,
    auth = true,
    retry = true,
  } = options;

  // Fail fast instead of hanging the UI: big uploads get a longer window.
  const timeoutMs = path.includes('attachments') ? 120000 : 20000;

  const primaryUrl = `${config.apiBaseUrl}${path}`;
  let response;
  let lastError = null;

  // 1) Pehle primary URL try karein.
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      response = await fetch(primaryUrl, {
        method,
        headers: buildHeaders(auth),
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  } catch (_error) {
    lastError = _error;
  }

  // 2) Agar primary fail hua aur fallback URLs configured hain, toh unhein try karein.
  if (!response && FALLBACK_URLS.length > 0) {
    for (const base of FALLBACK_URLS) {
      const fallbackUrl = base.replace(/\/$/, '') + path;
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
          response = await fetch(fallbackUrl, {
            method,
            headers: buildHeaders(auth),
            body: body === undefined ? undefined : JSON.stringify(body),
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timer);
        }
        if (response) break;
      } catch (_fbError) {
        lastError = _fbError;
        continue;
      }
    }
  }

  if (!response) {
    apiLog(method, primaryUrl, 'NETWORK_ERROR', body);
    // Frontend-only offline fallback: jab backend connect na ho,
    // toh mock data return kare taaki app crash na kare aur dashboard chal rahe rahe.
    const mock = getMockForPath(path);
    if (mock) {
      return { ...mock.data, __offline: true };
    }
    throw new ApiError(
      'Unable to reach the server. Check your connection and try again.',
      0,
      'NETWORK',
      lastError,
    );
  }

  apiLog(method, primaryUrl, response.status, body);

  if (response.status === 401 && auth && retry && !SKIP_REFRESH.has(path)) {
    const refreshed = await refreshAccessToken();
    if (!refreshed) {
      if (sessionExpiredHandler) await sessionExpiredHandler();
      throw new ApiError('Your session has ended. Please sign in again.', 401, 'SESSION_EXPIRED');
    }
    return request(path, { method, body, auth, retry: false });
  }

  const payload = await parseBody(response);
  if (!response.ok || !payload || payload.success === false) {
    const error = payload && payload.error ? payload.error : {};
    throw new ApiError(
      error.message || 'Something went wrong. Please try again.',
      response.status,
      error.code || 'ERROR',
      error.details,
    );
  }
  return payload.data;
}

/**
 * Backend connection test karne ke liye helper.
 * Dashboard ya kisi screen se call karke check kiya ja sakta hai ki server reachable hai ya nahi.
 */
export async function testApiConnection() {
  const url = `${config.apiBaseUrl}/api/auth/me`;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: buildHeaders(false),
        signal: controller.signal,
      });
      clearTimeout(timer);
      return { ok: res.ok, status: res.status, url };
    } finally {
      clearTimeout(timer);
    }
  } catch (error) {
    return { ok: false, status: 0, error: error.message, url };
  }
}
