import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminApiService } from '../../../../core/services/admin-api.service';
import type { PlatformRegistration } from '../../../../core/models/user.model';

type AppFilter = 'all' | 'energy-hub' | 'service-admin';

@Component({
  selector: 'app-directory-page',
  imports: [RouterLink],
  templateUrl: './directory-page.html',
  styleUrl: './directory-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DirectoryPage {
  private readonly api = inject(AdminApiService);

  readonly registrations = signal<PlatformRegistration[]>([]);
  readonly activeFilter = signal<AppFilter>('all');
  readonly search = signal('');
  readonly page = signal(1);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly pageSize = 24;

  readonly filtered = computed(() => {
    const query = this.search().trim().toLowerCase();
    return this.registrations().filter((registration) => {
      const matchesApp = this.activeFilter() === 'all' || registration.app === this.activeFilter();
      const searchable = [
        registration.name,
        registration.email,
        registration.phone,
        registration.registrationId,
        registration.role,
        registration.profile.businessName,
        registration.profile.companyName,
      ].filter(Boolean).join(' ').toLowerCase();
      return matchesApp && (!query || searchable.includes(query));
    });
  });

  readonly energyHubCount = computed(
    () => this.registrations().filter((registration) => registration.app === 'energy-hub').length,
  );
  readonly serviceAdminCount = computed(
    () => this.registrations().filter((registration) => registration.app === 'service-admin').length,
  );
  readonly onlineCount = computed(
    () => this.registrations().filter(
      (registration) => registration.app === 'energy-hub' && registration.profile.online === true,
    ).length,
  );
  readonly onlineRate = computed(() =>
    this.energyHubCount()
      ? Math.round((this.onlineCount() / this.energyHubCount()) * 100)
      : 0,
  );
  readonly pageCount = computed(() => Math.max(1, Math.ceil(this.filtered().length / this.pageSize)));
  readonly visibleRegistrations = computed(() => {
    const start = (this.page() - 1) * this.pageSize;
    return this.filtered().slice(start, start + this.pageSize);
  });
  readonly showingStart = computed(() =>
    this.filtered().length ? (this.page() - 1) * this.pageSize + 1 : 0,
  );
  readonly showingEnd = computed(() =>
    Math.min(this.page() * this.pageSize, this.filtered().length),
  );

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.registrations.set(await this.api.getRegistrations());
    } catch (error) {
      this.error.set(this.api.errorMessage(error, 'Unable to load registered accounts.'));
    } finally {
      this.loading.set(false);
    }
  }

  setFilter(filter: AppFilter): void {
    this.activeFilter.set(filter);
    this.page.set(1);
  }

  changePage(nextPage: number): void {
    this.page.set(Math.min(Math.max(nextPage, 1), this.pageCount()));
  }

  updateSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
    this.page.set(1);
  }

  clearSearch(): void {
    this.search.set('');
    this.page.set(1);
  }

  clearFilters(): void {
    this.activeFilter.set('all');
    this.clearSearch();
  }

  appLabel(app: PlatformRegistration['app']): string {
    return app === 'energy-hub' ? 'Energy Hub' : 'Service Admin';
  }

  appIconName(app: PlatformRegistration['app']): 'pulse' | 'tool' {
    return app === 'energy-hub' ? 'pulse' : 'tool';
  }

  formatLabel(value: string | null | undefined): string {
    if (!value) return 'Not provided';
    return value.replace(/[_-]+/g, ' ').replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
  }

  formatDate(value: string | null): string {
    if (!value) return 'Not recorded';
    const date = Date.parse(value);
    return Number.isNaN(date)
      ? 'Not recorded'
      : new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(date);
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(value);
  }
}
