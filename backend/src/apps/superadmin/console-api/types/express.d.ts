import type { StoredUser } from '../domain/models.js';
import type { Session } from '../services/sessions.js';

declare global {
  namespace Express {
    interface Request {
      authUser?: StoredUser;
      authSession?: Session;
      authSessionId?: string;
      authSessionSource?: 'cookie' | 'bearer';
    }
  }
}

export {};
