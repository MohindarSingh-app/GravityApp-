import { hashPassword, verifyPassword } from './passwords.js';
import { JsonStore } from '../infrastructure/json-store.js';
import type { StoredUser } from '../domain/models.js';

const MAX_ATTEMPTS = 5;
const LOCK_MS = 5 * 60 * 1000;
const DUMMY = hashPassword('not-a-real-password-used-for-timing');

interface FailureState {
  attempts: number;
  lockedUntil: number;
}

export class AuthenticationService {
  private readonly failures = new Map<string, FailureState>();

  constructor(private readonly store: JsonStore) {}

  async authenticate(
    emailInput: string,
    password: string,
    ipAddress: string,
  ): Promise<StoredUser | undefined> {
    const email = emailInput.trim().toLowerCase();
    const key = `${ipAddress}:${email}`;
    const now = Date.now();
    const failure = this.failures.get(key);

    if (failure?.lockedUntil && failure.lockedUntil > now) {
      await this.store.recordAudit(null, 'auth.login_throttled', 'account', email, {});
      return undefined;
    }

    const user = await this.store.getUserByEmail(email);
    const valid = verifyPassword(
      password,
      user?.passwordSalt ?? DUMMY.salt,
      user?.passwordHash ?? DUMMY.hash,
    );
    if (!user || !valid || user.disabled) {
      const attempts = (failure?.attempts ?? 0) + 1;
      const lockedUntil = attempts >= MAX_ATTEMPTS ? now + LOCK_MS : 0;
      this.failures.set(key, { attempts, lockedUntil });
      await this.store.recordAudit(null, 'auth.login_failed', 'account', email, {
        locked: lockedUntil > 0,
      });
      return undefined;
    }

    this.failures.delete(key);
    await this.store.recordAudit(user, 'auth.login_succeeded', 'user', user.id);
    return user;
  }

  async recordLogout(user: StoredUser): Promise<void> {
    await this.store.recordAudit(user, 'auth.logout', 'user', user.id);
  }
}
