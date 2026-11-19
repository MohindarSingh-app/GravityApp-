import type { StoredUser } from '../domain/models.js';

declare global {
  namespace Express {
    interface Request {
      authUser?: StoredUser;
    }
  }
}

export {};
