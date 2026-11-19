import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { AdminApiService } from '../../../../core/services/admin-api.service';
import type { AuditEntry } from '../../../../core/models/user.model';

type AuditFilter =
  | 'all'
  | 'auth.login_succeeded'
  | 'auth.login_failed'
  | 'auth.logout'
  | 'user.created'
  | 'user.updated'
  | 'user.permissions_updated'
  | 'permissions.updated';

@Component({
  selector: 'app-activity-page',
  imports: [DatePipe],
  templateUrl: './activity-page.html',
  styleUrl: './activity-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActivityPage {
  private readonly api = inject(AdminApiService);

  readonly filter = signal<AuditFilter>('all');
  readonly events = signal<AuditEntry[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly filters: AuditFilter[] = [
    'all',
    'auth.login_succeeded',
    'auth.login_failed',
    'auth.logout',
    'user.created',
    'user.updated',
    'user.permissions_updated',
    'permissions.updated',
  ];

  readonly entries = computed(() => {
    const filter = this.filter();
    return filter === 'all'
      ? this.events()
      : this.events().filter((event) => event.action === filter);
  });

  readonly counts = computed(() => ({
    logins: this.events().filter((event) => event.action === 'auth.login_succeeded').length,
    failed: this.events().filter((event) => event.action === 'auth.login_failed').length,
    changes: this.events().filter((event) =>
      event.action === 'user.created' ||
      event.action === 'user.updated' ||
      event.action === 'user.permissions_updated' ||
      event.action === 'permissions.updated',
    ).length,
  }));

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.events.set(await this.api.getAuditEvents());
    } catch (error) {
      this.error.set(this.api.errorMessage(error, 'Unable to load audit events.'));
    } finally {
      this.loading.set(false);
    }
  }

  setFilter(filter: AuditFilter): void {
    this.filter.set(filter);
  }

  filterLabel(filter: string): string {
    return filter === 'all' ? 'All events' : filter.replaceAll('.', ' ').replaceAll('_', ' ');
  }

  eventDetails(details: AuditEntry['details']): string {
    return Object.entries(details)
      .map(([key, value]) => `${key}: ${String(value)}`)
      .join(' · ');
  }
}
