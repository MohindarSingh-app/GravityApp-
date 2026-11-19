import type { RequestHandler } from 'express5';
import { AccessControlService } from '../services/access-control.js';
import { SessionManager } from '../services/sessions.js';
import { JsonStore } from '../infrastructure/json-store.js';
import { isPageKey, isPermissionAction, type PageKey, type PermissionAction } from '../domain/permissions.js';

const SESSION_COOKIE = 'eh_session';

export function readSessionCookie(cookieHeader: string | undefined): string | undefined {
  const pair = cookieHeader?.split(';').map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`));
  return pair?.slice(SESSION_COOKIE.length + 1);
}

export function requireAuth(store: JsonStore, sessions: SessionManager): RequestHandler {
  return async (request, response, next): Promise<void> => {
    const sessionId = readSessionCookie(request.headers.cookie);
    const session = sessionId ? sessions.get(sessionId) : undefined;
    const user = session ? await store.getUserById(session.userId) : undefined;
    if (!sessionId || !session || !user || user.disabled) {
      if (sessionId && session) sessions.revoke(sessionId);
      response.status(401).json({ message: 'Authentication required.' });
      return;
    }
    request.authUser = user;
    next();
  };
}

export function requirePermission(
  access: AccessControlService,
  page: PageKey,
  action: PermissionAction,
): RequestHandler {
  return async (request, response, next): Promise<void> => {
    const user = request.authUser;
    if (!user) {
      response.status(401).json({ message: 'Authentication required.' });
      return;
    }
    if (!(await access.can(user, page, action))) {
      await access.recordDenied(user, page, action);
      response.status(403).json({ message: 'You do not have permission to perform this action.' });
      return;
    }
    next();
  };
}

export const requireSuperadmin: RequestHandler = (request, response, next) => {
  if (request.authUser?.role !== 'superadmin') {
    response.status(403).json({ message: 'Superadmin access required.' });
    return;
  }
  next();
};

export function isPageAndAction(page: unknown, action: unknown): boolean {
  return isPageKey(page) && isPermissionAction(action);
}
