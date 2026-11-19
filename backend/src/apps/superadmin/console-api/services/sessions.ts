import { randomBytes } from 'node:crypto';

const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

interface Session {
  userId: string;
  expiresAt: number;
}

export class SessionManager {
  private readonly sessions = new Map<string, Session>();

  create(userId: string): { id: string; expiresAt: number } {
    const id = randomBytes(32).toString('base64url');
    const expiresAt = Date.now() + SESSION_TTL_MS;
    this.sessions.set(id, { userId, expiresAt });
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
}
