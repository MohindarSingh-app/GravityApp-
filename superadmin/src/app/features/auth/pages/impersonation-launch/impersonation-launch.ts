import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';

@Component({
  selector: 'app-impersonation-launch',
  template: `
    <main class="launch-page">
      <section class="launch-card" aria-live="polite">
        @if (error()) {
          <h1>Could not open this user panel</h1>
          <p>{{ error() }}</p>
          <p>You can close this tab and create a fresh link from Users &amp; Roles.</p>
        } @else {
          <div class="launch-spinner" aria-hidden="true"></div>
          <h1>Opening user panel</h1>
          <p>Verifying the one-time link and loading account permissions…</p>
        }
      </section>
    </main>
  `,
  styles: [`
    .launch-page {
      display: grid;
      min-height: 100dvh;
      place-items: center;
      padding: 24px;
      background: var(--body-bg, #f3f5f9);
      color: var(--t, #1d2939);
      font: 14px/1.5 system-ui, sans-serif;
    }
    .launch-card {
      width: min(100%, 440px);
      padding: 28px;
      border: 1px solid var(--border, #dce2ea);
      border-radius: 16px;
      background: var(--surface, #fff);
      text-align: center;
    }
    h1 { margin: 0 0 8px; font-size: 20px; }
    p { margin: 6px 0 0; color: var(--t-2, #667085); }
    .launch-spinner {
      width: 28px;
      height: 28px;
      margin: 0 auto 16px;
      border: 3px solid var(--border, #dce2ea);
      border-top-color: var(--primary, #635bff);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) {
      .launch-spinner { animation-duration: 2s; }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImpersonationLaunch {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly error = signal<string | null>(null);

  constructor() {
    const token = new URLSearchParams(window.location.hash.slice(1)).get('token');
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
    if (!token) {
      this.error.set('The one-time launch link is missing its token.');
      return;
    }
    void this.openPanel(token);
  }

  private async openPanel(token: string): Promise<void> {
    try {
      await this.auth.exchangeImpersonationLaunch(token);
      await this.router.navigateByUrl(this.auth.firstAccessibleRoute(), { replaceUrl: true });
    } catch (error) {
      this.error.set(this.errorMessage(error));
    }
  }

  private errorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const message = error.error && typeof error.error === 'object'
        ? (error.error as { message?: unknown }).message
        : undefined;
      if (typeof message === 'string') return message;
    }
    return 'The Superadmin service could not verify this link. Try again from Users & Roles.';
  }
}
