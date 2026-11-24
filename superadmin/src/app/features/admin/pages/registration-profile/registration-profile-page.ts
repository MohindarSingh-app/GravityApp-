import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AdminApiService } from '../../../../core/services/admin-api.service';
import type { PlatformRegistrationDetails } from '../../../../core/models/user.model';

type ProfileTab = 'overview' | 'work' | 'finance' | 'account';

@Component({
  selector: 'app-registration-profile-page',
  imports: [RouterLink],
  templateUrl: './registration-profile-page.html',
  styleUrl: './registration-profile-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegistrationProfilePage {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(AdminApiService);
  private requestVersion = 0;

  readonly details = signal<PlatformRegistrationDetails | null>(null);
  readonly activeTab = signal<ProfileTab>('overview');
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly hasMonthlyAmounts = computed(
    () => this.details()?.monthlyActivity.some((item) => item.amount > 0) ?? false,
  );
  readonly maxMonthlyCount = computed(() => {
    const counts = this.details()?.monthlyActivity.map((item) => item.count) ?? [];
    return Math.max(1, ...counts);
  });
  readonly maxMonthlyAmount = computed(() => {
    const amounts = this.details()?.monthlyActivity.map((item) => item.amount) ?? [];
    return Math.max(1, ...amounts);
  });
  readonly maxStatusCount = computed(() => {
    const counts = this.details()?.statusBreakdown.map((item) => item.count) ?? [];
    return Math.max(1, ...counts);
  });
  readonly completionRate = computed(() => {
    const profile = this.details()?.registration.profile;
    if (!profile || profile.totalServices === 0) return 0;
    return Math.round((profile.completedServices / profile.totalServices) * 100);
  });

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const id = params.get('id');
      if (id) void this.load(id);
    });
  }

  async load(id: string): Promise<void> {
    const requestVersion = ++this.requestVersion;
    this.loading.set(true);
    this.error.set(null);
    try {
      const details = await this.api.getRegistrationDetails(id);
      if (requestVersion === this.requestVersion) this.details.set(details);
    } catch (error) {
      if (requestVersion === this.requestVersion) {
        this.error.set(this.api.errorMessage(error, 'Unable to load this registration profile.'));
      }
    } finally {
      if (requestVersion === this.requestVersion) this.loading.set(false);
    }
  }

  selectTab(tab: ProfileTab): void {
    this.activeTab.set(tab);
  }

  countBarHeight(value: number): number {
    return Math.max(value > 0 ? 8 : 0, (value / this.maxMonthlyCount()) * 100);
  }

  amountBarHeight(value: number): number {
    return Math.max(value > 0 ? 8 : 0, (value / this.maxMonthlyAmount()) * 100);
  }

  statusBarWidth(value: number): number {
    return (value / this.maxStatusCount()) * 100;
  }

  formatDate(value: string | null): string {
    if (!value) return 'Not recorded';
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? value
      : new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  }

  formatMoney(value: number | null, currency = 'INR'): string {
    if (value === null) return 'Not available';
    const amount = value.toLocaleString('en-IN', { maximumFractionDigits: 0 });
    return currency === 'INR' ? `₹${amount}` : `${currency} ${amount}`;
  }

  formatExperience(value: string | null): string {
    if (!value) return 'Not recorded';
    return /\b(?:years?|yrs?)\b/i.test(value) ? value : `${value} years`;
  }

  mapUrl(location: { latitude: number; longitude: number }): string {
    return `https://www.google.com/maps?q=${location.latitude},${location.longitude}`;
  }

  statusLabel(value: string): string {
    return value.replace(/[_-]/g, ' ');
  }

  appLabel(app: PlatformRegistrationDetails['registration']['app']): string {
    return app === 'energy-hub' ? 'Energy Hub' : 'Service Admin';
  }

  activityLabel(kind: string): string {
    const labels: Record<string, string> = {
      job: 'Partner job',
      service: 'Service request',
      repair: 'Repair',
      project: 'Project',
      amc: 'AMC contract',
    };
    return labels[kind] || kind;
  }
}
