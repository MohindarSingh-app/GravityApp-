import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { PageKey } from '../../../../core/models/user.model';
import { AuthService } from '../../../../core/services/auth.service';
import { OperationsService, type Job } from '../../../../core/services/operations.service';

interface DashboardMetric {
  label: string;
  value: string;
  context: string;
  route: string;
  page: PageKey;
  tone: 'primary' | 'accent' | 'warn' | 'danger';
}

interface AttentionItem {
  label: string;
  detail: string;
  value: string;
  count: number;
  route: string;
  page: PageKey;
  tone: 'warn' | 'danger' | 'primary';
}

@Component({
  selector: 'app-dashboard-page',
  imports: [RouterLink],
  templateUrl: './dashboard-page.html',
  styleUrl: './dashboard-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardPage {
  private readonly auth = inject(AuthService);
  readonly ops = inject(OperationsService);
  readonly user = this.auth.currentUser;

  readonly greeting = computed(() => {
    const hour = new Date().getHours();
    return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  });

  readonly sessionExpiryLabel = computed(() => {
    const expiresAt = this.auth.sessionExpiresAt();
    return expiresAt
      ? new Date(expiresAt).toLocaleString([], {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        })
      : null;
  });

  readonly metrics = computed(() => {
    const riskCount = this.ops.slaRiskJobs().length;
    const candidates: DashboardMetric[] = [
      {
        label: 'Customer companies',
        value: `${this.ops.companies.length}`,
        context: 'registered on the platform',
        route: '/companies',
        page: 'companies',
        tone: 'primary',
      },
      {
        label: 'Partners online',
        value: `${this.ops.partnersOnline().length}`,
        context: `of ${this.ops.partners().length} directory partners`,
        route: '/directory',
        page: 'directory',
        tone: 'accent',
      },
      {
        label: 'Open service jobs',
        value: `${this.ops.liveJobs().length}`,
        context: `${riskCount} need SLA follow-up`,
        route: '/jobs',
        page: 'jobs',
        tone: riskCount ? 'danger' : 'warn',
      },
      {
        label: 'Revenue this month',
        value: this.formatCurrency(this.ops.monthRevenue()),
        context: 'sample billed value',
        route: '/finance',
        page: 'finance',
        tone: 'primary',
      },
    ];
    return candidates.filter((metric) => this.auth.canAccess(metric.page));
  });

  readonly priorityJobs = computed(() => {
    if (!this.auth.canAccess('jobs')) return [];
    const order: Record<Job['status'], number> = {
      'sla-risk': 0,
      unassigned: 1,
      progress: 2,
      completed: 3,
    };
    return [...this.ops.liveJobs()]
      .sort((a, b) => order[a.status] - order[b.status] ||
        (a.slaMinsLeft ?? Number.MAX_SAFE_INTEGER) - (b.slaMinsLeft ?? Number.MAX_SAFE_INTEGER))
      .slice(0, 4);
  });

  readonly attentionItems = computed(() => {
    const overdue = this.ops.invoices().filter((invoice) => invoice.status === 'overdue');
    const payouts = this.ops.pendingPayouts();
    const candidates: AttentionItem[] = [
      {
        label: 'Partner applications',
        detail: 'Documents awaiting review',
        value: `${this.ops.pendingApprovals()}`,
        count: this.ops.pendingApprovals(),
        route: '/verification',
        page: 'verification',
        tone: 'warn',
      },
      {
        label: 'Open disputes',
        detail: 'Need an owner and resolution',
        value: `${this.ops.openDisputes().length}`,
        count: this.ops.openDisputes().length,
        route: '/disputes',
        page: 'disputes',
        tone: 'danger',
      },
      {
        label: 'Overdue invoices',
        detail: this.formatCurrency(overdue.reduce((sum, invoice) => sum + invoice.amount, 0)),
        value: `${overdue.length}`,
        count: overdue.length,
        route: '/invoices',
        page: 'invoices',
        tone: 'danger',
      },
      {
        label: 'Partner payouts pending',
        detail: `${payouts.length} settlements to review`,
        value: this.formatCurrency(this.ops.pendingPayoutTotal()),
        count: payouts.length,
        route: '/finance',
        page: 'finance',
        tone: 'primary',
      },
      {
        label: 'Low-stock items',
        detail: 'Below the configured minimum',
        value: `${this.ops.lowStockItems().length}`,
        count: this.ops.lowStockItems().length,
        route: '/inventory',
        page: 'inventory',
        tone: 'warn',
      },
      {
        label: 'Contracts expiring soon',
        detail: 'Within the next 30 days',
        value: `${this.ops.expiringAmcs().length}`,
        count: this.ops.expiringAmcs().length,
        route: '/amc',
        page: 'amc',
        tone: 'warn',
      },
    ];
    return candidates.filter((item) => item.count > 0 && this.auth.canAccess(item.page)).slice(0, 5);
  });

  readonly revenueTrend = computed(() => {
    const points = this.ops.revenueTrend;
    const maximum = Math.max(...points.map((point) => point.value), 1);
    return points.map((point) => ({
      ...point,
      height: Math.max(8, Math.round((point.value / maximum) * 100)),
    }));
  });

  readonly canViewJobs = computed(() => this.auth.canAccess('jobs'));
  readonly canViewFinance = computed(() => this.auth.canAccess('finance'));

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(value);
  }

  jobStatusLabel(job: Job): string {
    if (job.status === 'sla-risk') return 'SLA risk';
    return job.status === 'unassigned' ? 'Unassigned' : 'In progress';
  }

  jobTimeLabel(job: Job): string {
    if (job.slaMinsLeft === null) return 'SLA not set';
    return job.slaMinsLeft <= 0 ? 'Overdue' : `${job.slaMinsLeft} min left`;
  }
}
