import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { PageKey, PermissionAction, User } from '../models/user.model';

const API_PREFIX = '/api/superadmin/console';

interface AuthResponse {
  user: User;
  expiresAt: number;
}

interface SessionResponse {
  user: User | null;
  expiresAt: number | null;
}

interface LocalDemoResponse {
  enabled: boolean;
  credentials?: { email: string; password: string };
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly userSignal = signal<User | null>(null);
  private readonly sessionExpiresAtSignal = signal<number | null>(null);
  private readonly readySignal = signal(false);
  private readonly sessionErrorSignal = signal<string | null>(null);
  private restoring: Promise<void> | null = null;

  readonly currentUser = this.userSignal.asReadonly();
  readonly sessionExpiresAt = this.sessionExpiresAtSignal.asReadonly();
  readonly isAuthenticated = computed(() => this.userSignal() !== null);
  readonly sessionReady = this.readySignal.asReadonly();
  readonly sessionError = this.sessionErrorSignal.asReadonly();

  constructor() {
    for (const key of ['eh_accounts', 'eh_session', 'eh_activity', 'eh_lock', 'eh_fails']) {
      localStorage.removeItem(key);
    }
  }

  restoreSession(): Promise<void> {
    if (this.readySignal()) return Promise.resolve();
    if (!this.restoring) {
      this.restoring = firstValueFrom(
        this.http.get<SessionResponse>(`${API_PREFIX}/auth/me`, { withCredentials: true }),
      )
        .then(({ user, expiresAt }) => {
          this.userSignal.set(user);
          this.sessionExpiresAtSignal.set(user ? expiresAt : null);
        })
        .catch((error: unknown) => {
          if (error instanceof HttpErrorResponse && error.status === 401) {
            this.userSignal.set(null);
            this.sessionExpiresAtSignal.set(null);
            return;
          }
          this.userSignal.set(null);
          this.sessionExpiresAtSignal.set(null);
          this.sessionErrorSignal.set(
            this.getErrorMessage(error, 'Could not connect to the authentication service.'),
          );
        })
        .finally(() => {
          this.readySignal.set(true);
          this.restoring = null;
        });
    }
    return this.restoring;
  }

  async refreshSession(): Promise<void> {
    try {
      const { user, expiresAt } = await firstValueFrom(
        this.http.get<SessionResponse>(`${API_PREFIX}/auth/me`, { withCredentials: true }),
      );
      this.userSignal.set(user);
      this.sessionExpiresAtSignal.set(user ? expiresAt : null);
      this.sessionErrorSignal.set(null);
    } catch (error) {
      this.userSignal.set(null);
      this.sessionExpiresAtSignal.set(null);
      this.sessionErrorSignal.set(
        this.getErrorMessage(error, 'Could not refresh your permissions from the server.'),
      );
    }
  }

  async login(email: string, password: string): Promise<{ ok: boolean; message?: string }> {
    try {
      const { user, expiresAt } = await firstValueFrom(
        this.http.post<AuthResponse>(
          `${API_PREFIX}/auth/login`,
          { email, password },
          { withCredentials: true },
        ),
      );
      this.userSignal.set(user);
      this.sessionExpiresAtSignal.set(expiresAt);
      this.sessionErrorSignal.set(null);
      this.readySignal.set(true);
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        message: this.getErrorMessage(error, 'Could not connect to the authentication service.'),
      };
    }
  }

  async getLocalDemoCredentials(): Promise<{ email: string; password: string } | null> {
    const response = await firstValueFrom(
      this.http.get<LocalDemoResponse>(`${API_PREFIX}/auth/local-demo`),
    );
    return response.enabled ? response.credentials ?? null : null;
  }

  async logout(): Promise<void> {
    await firstValueFrom(
      this.http.post<void>(`${API_PREFIX}/auth/logout`, {}, { withCredentials: true }),
    );
    this.userSignal.set(null);
    this.sessionExpiresAtSignal.set(null);
    this.readySignal.set(true);
  }

  clearSessionError(): void {
    this.sessionErrorSignal.set(null);
  }

  canAccess(page: PageKey, action: PermissionAction = 'view'): boolean {
    const user = this.userSignal();
    return !!user && (user.role === 'superadmin' || user.permissions[page][action]);
  }

  firstAccessibleRoute(): string {
    const user = this.userSignal();
    if (!user) return '/auth/login';
    const firstPage = Object.entries(user.permissions).find(([, permissions]) => permissions.view);
    const page = firstPage?.[0];
    if (!page) return '/auth/login';
    if (['customer-panel', 'partner-app', 'users', 'activity', 'settings'].includes(page)) {
      return `/modules/${page}`;
    }
    return `/${page}`;
  }

  private getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse) {
      const message = error.error && typeof error.error === 'object'
        ? (error.error as { message?: unknown }).message
        : undefined;
      if (typeof message === 'string') return message;
    }
    return fallback;
  }
}
