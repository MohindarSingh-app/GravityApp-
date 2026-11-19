import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { OperationsService } from '../../../../core/services/operations.service';

@Component({
  selector: 'app-analytics-page',
  imports: [],
  templateUrl: './analytics-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnalyticsPage {
  readonly ops = inject(OperationsService);

  readonly kpis = [
    { label: 'Monthly Revenue', value: '₹2,42,000', delta: '↑ 11% vs last month', up: true, icon: '₹' },
    { label: 'Jobs Completed', value: '184', delta: '↑ 8% vs last month', up: true, icon: '✓' },
    { label: 'Avg Job Value', value: '₹1,315', delta: '↓ 3% vs last month', up: false, icon: '↗' },
    { label: 'Repeat Customer Rate', value: '42%', delta: '↑ 5% vs last month', up: true, icon: '👤' },
  ];

  /** bar height % for trend chart */
  trendHeight(value: number): number {
    const max = Math.max(...this.ops.revenueTrend.map((d) => d.value));
    return Math.round((value / max) * 100);
  }

  hoursHeight(value: number): number {
    const max = Math.max(...this.ops.peakHours.map((d) => d.value));
    return Math.round((value / max) * 100);
  }

  categoryTotal(): number {
    return this.ops.categoryRevenue.reduce((n, c) => n + c.value, 0);
  }

  categoryPct(value: number): number {
    return Math.round((value / this.categoryTotal()) * 100);
  }
}
