import { randomBytes } from 'node:crypto';

const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const IMPERSONATION_TTL_MS = 30 * 60 * 1000;
const IMPERSONATION_LAUNCH_TTL_MS = 60 * 1000;

export interface SessionImpersonation {
  id: string;
  name: string;
  email: string;
}

export interface Session {
  userId: string;
  expiresAt: number;
  impersonatedBy?: SessionImpersonation;
}

interface ImpersonationLaunch {
  actorId: string;
  targetId: string;
  expiresAt: number;
}

export class SessionManager {
  private readonly sessions = new Map<string, Session>();
  private readonly impersonationLaunches = new Map<string, ImpersonationLaunch>();

  create(userId: string): { id: string; expiresAt: number } {
    this.revokeUserSessions(userId);
    const id = randomBytes(32).toString('base64url');
    const expiresAt = Date.now() + SESSION_TTL_MS;
    this.sessions.set(id, { userId, expiresAt });
    return { id, expiresAt };
  }

  createImpersonationLaunch(actorId: string, targetId: string): {
    token: string;
    expiresAt: number;
  } {
    this.deleteExpiredLaunches();
    const token = randomBytes(32).toString('base64url');
    const expiresAt = Date.now() + IMPERSONATION_LAUNCH_TTL_MS;
    this.impersonationLaunches.set(token, { actorId, targetId, expiresAt });
    return { token, expiresAt };
  }

  consumeImpersonationLaunch(token: string): ImpersonationLaunch | undefined {
    const launch = this.impersonationLaunches.get(token);
    this.impersonationLaunches.delete(token);
    if (!launch || launch.expiresAt <= Date.now()) return undefined;
    return launch;
  }

  createImpersonationSession(
    userId: string,
    impersonatedBy: SessionImpersonation,
  ): { id: string; expiresAt: number } {
    this.revokeUserSessions(userId);
    const id = randomBytes(32).toString('base64url');
    const expiresAt = Date.now() + IMPERSONATION_TTL_MS;
    this.sessions.set(id, { userId, expiresAt, impersonatedBy });
    return { id, expiresAt };
  }

  get(id: string): Session | undefined {
    const session = this.sessions.get(id);
    if (!session) return undefined;
    if (session.expiresAt <= Date.now()) {
      this.sessions.delete(id);
      return undefined;
    }
    return session;
  }

  revoke(id: string): void {
    this.sessions.delete(id);
  }

  revokeOtherSessions(userId: string, exceptSessionId: string): void {
    for (const [id, session] of this.sessions) {
      if (session.userId === userId && id !== exceptSessionId) {
        this.sessions.delete(id);
      }
    }
  }

  revokeUserAccess(userId: string): void {
    this.revokeUserSessions(userId);
    for (const [token, launch] of this.impersonationLaunches) {
      if (launch.actorId === userId || launch.targetId === userId) {
        this.impersonationLaunches.delete(token);
      }
    }
  }

  private revokeUserSessions(userId: string): void {
    for (const [id, session] of this.sessions) {
      if (session.userId === userId) this.sessions.delete(id);
    }
  }

  private deleteExpiredLaunches(): void {
    const now = Date.now();
    for (const [token, launch] of this.impersonationLaunches) {
      if (launch.expiresAt <= now) this.impersonationLaunches.delete(token);
    }
  }
}
