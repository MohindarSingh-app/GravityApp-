import { config } from '../config/env';

export function avatarUri(path) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return `${config.apiBaseUrl}${path}`;
}
