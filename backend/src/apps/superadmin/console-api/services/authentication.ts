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
  private readonly passwordChangeFailures = new Map<string, FailureState>();

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

  async changePassword(
    user: StoredUser,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    if (newPassword.length < 12 || newPassword.length > 200) {
      throw new PasswordChangeError('New password must be between 12 and 200 characters.');
    }
    if (currentPassword.length === 0 || currentPassword.length > 200) {
      throw new PasswordChangeError('Current password is incorrect.');
    }
    if (currentPassword === newPassword) {
      throw new PasswordChangeError('Choose a new password different from your current password.');
    }

    const now = Date.now();
    const failure = this.passwordChangeFailures.get(user.id);
    if (failure?.lockedUntil && failure.lockedUntil > now) {
      throw new PasswordChangeError('Too many incorrect attempts. Try again in five minutes.');
    }
    if (!verifyPassword(currentPassword, user.passwordSalt, user.passwordHash)) {
      const attempts = failure?.lockedUntil && failure.lockedUntil <= now
        ? 1
        : (failure?.attempts ?? 0) + 1;
      const lockedUntil = attempts >= MAX_ATTEMPTS ? now + LOCK_MS : 0;
      this.passwordChangeFailures.set(user.id, { attempts, lockedUntil });
      await this.store.recordAudit(user, 'auth.password_change_failed', 'user', user.id, {
        locked: lockedUntil > 0,
      });
      throw new PasswordChangeError('Current password is incorrect.');
    }

    const credentials = hashPassword(newPassword);
    const updated = await this.store.updatePassword(user.id, {
      passwordSalt: credentials.salt,
      passwordHash: credentials.hash,
    }, user);
    if (!updated) throw new Error('Authenticated user was not found while changing the password.');
    this.passwordChangeFailures.delete(user.id);
  }
}

export class PasswordChangeError extends Error {}
