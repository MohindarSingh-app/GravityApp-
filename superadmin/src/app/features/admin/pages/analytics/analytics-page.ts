import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { OperationsService } from '../../../../core/services/operations.service';

type CategoryId = 'service' | 'repair' | 'amc' | 'ecart' | 'projects';
type CategoryFilter = CategoryId | 'all';
type RangePreset = '24h' | '7d' | '30d' | '90d' | '12m' | 'custom';
type Granularity = 'auto' | 'hour' | 'day' | 'week' | 'month';

interface DateRange {
  start: Date;
  end: Date;
}

interface RevenueCategory {
  id: CategoryId;
  label: string;
}

interface BucketValue {
  revenue: number;
  activity: number;
}

type CategoryValues = Record<CategoryId, BucketValue>;

interface AnalyticsPoint {
  key: number;
  label: string;
  detail: string;
  categories: CategoryValues;
}

interface CategorySummary extends RevenueCategory {
  revenue: number;
  activity: number;
  average: number;
  share: number;
  change: number | null;
}

interface AnalyticsData {
  revenue: number;
  activity: number;
  points: AnalyticsPoint[];
  categories: CategorySummary[];
}

interface ReportCategory extends CategorySummary {
  change: number | null;
}

interface AnalyticsReport {
  revenue: number;
  activity: number;
  average: number;
  categories: ReportCategory[];
  points: Array<AnalyticsPoint & BucketValue>;
  topCategory: ReportCategory | null;
}

interface AnalyticsKpi {
  label: string;
  value: string;
  detail: string;
  icon: string;
  trend: 'up' | 'down' | 'flat';
}

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_CHART_POINTS = 60;

const REVENUE_CATEGORIES: RevenueCategory[] = [
  { id: 'service', label: 'Service earnings' },
  { id: 'repair', label: 'Repairs' },
  { id: 'amc', label: 'AMC' },
  { id: 'ecart', label: 'Paid orders' },
  { id: 'projects', label: 'Projects' },
];

const RANGE_PRESETS: Array<{ id: RangePreset; label: string }> = [
  { id: '24h', label: '24 hours' },
  { id: '7d', label: '7 days' },
  { id: '30d', label: '30 days' },
  { id: '90d', label: '90 days' },
  { id: '12m', label: '12 months' },
  { id: 'custom', label: 'Custom' },
];

const GRANULARITIES: Array<{ id: Granularity; label: string }> = [
  { id: 'auto', label: 'Automatic' },
  { id: 'hour', label: 'Hourly' },
  { id: 'day', label: 'Daily' },
  { id: 'week', label: 'Weekly' },
  { id: 'month', label: 'Monthly' },
];

function emptyCategoryValues(): CategoryValues {
  return {
    service: { revenue: 0, activity: 0 },
    repair: { revenue: 0, activity: 0 },
    amc: { revenue: 0, activity: 0 },
    ecart: { revenue: 0, activity: 0 },
    projects: { revenue: 0, activity: 0 },
  };
}

function dateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateInput(value: string, endOfDay: boolean): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  date.setHours(endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0);
  return date;
}

function startOfBucket(date: Date, granularity: Exclude<Granularity, 'auto'>): Date {
  const bucket = new Date(date);
  if (granularity === 'hour') {
    bucket.setMinutes(0, 0, 0);
  } else {
    bucket.setHours(0, 0, 0, 0);
    if (granularity === 'week') bucket.setDate(bucket.getDate() - ((bucket.getDay() + 6) % 7));
    if (granularity === 'month') bucket.setDate(1);
  }
  return bucket;
}

function nextBucket(date: Date, granularity: Exclude<Granularity, 'auto'>): Date {
  const next = new Date(date);
  if (granularity === 'hour') next.setHours(next.getHours() + 1);
  if (granularity === 'day') next.setDate(next.getDate() + 1);
  if (granularity === 'week') next.setDate(next.getDate() + 7);
  if (granularity === 'month') next.setMonth(next.getMonth() + 1);
  return next;
}

function bucketCount(range: DateRange, granularity: Exclude<Granularity, 'auto'>): number {
  let count = 0;
  let cursor = startOfBucket(range.start, granularity);
  while (cursor < range.end && count <= MAX_CHART_POINTS) {
    count += 1;
    cursor = nextBucket(cursor, granularity);
  }
  return count;
}

function autoGranularity(range: DateRange): Exclude<Granularity, 'auto'> {
  const duration = range.end.getTime() - range.start.getTime();
  if (duration <= 2 * DAY_MS) return 'hour';
  if (duration <= 45 * DAY_MS) return 'day';
  if (duration <= 180 * DAY_MS) return 'week';
  return 'month';
}

@Component({
  selector: 'app-analytics-page',
  imports: [],
  templateUrl: './analytics-page.html',
  styleUrl: './analytics-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnalyticsPage {
  readonly operations = inject(OperationsService);
  private readonly now = new Date();

  readonly rangePresets = RANGE_PRESETS;
  readonly granularityOptions = GRANULARITIES;
  readonly categoryOptions: Array<{ id: CategoryFilter; label: string }> = [
    { id: 'all', label: 'All categories' },
    ...REVENUE_CATEGORIES.map(({ id, label }) => ({ id, label })),
  ];

  readonly selectedPreset = signal<RangePreset>('30d');
  readonly selectedCategory = signal<CategoryFilter>('all');
  readonly selectedGranularity = signal<Granularity>('auto');
  readonly startDate = signal(dateInputValue(new Date(this.now.getTime() - 30 * DAY_MS)));
  readonly endDate = signal(dateInputValue(this.now));
  readonly maxDate = dateInputValue(this.now);

  readonly currentRange = computed(() => {
    if (this.selectedPreset() !== 'custom') return this.presetRange(this.selectedPreset());
    const start = parseDateInput(this.startDate(), false);
    const selectedEnd = parseDateInput(this.endDate(), true);
    if (!start || !selectedEnd || start > selectedEnd) return null;
    return { start, end: selectedEnd > this.now ? new Date(this.now) : selectedEnd };
  });

  readonly rangeError = computed(() => {
    if (this.selectedPreset() !== 'custom') return '';
    const start = parseDateInput(this.startDate(), false);
    const end = parseDateInput(this.endDate(), true);
    if (!start || !end) return 'Choose both a start date and an end date.';
    if (start > end) return 'The start date must be on or before the end date.';
    return '';
  });

  readonly resolvedGranularity = computed<Exclude<Granularity, 'auto'>>(() => {
    const range = this.currentRange();
    if (!range) return 'day';
    const selected = this.selectedGranularity();
    if (selected !== 'auto' && bucketCount(range, selected) <= MAX_CHART_POINTS) return selected;
    return autoGranularity(range);
  });

  readonly currentData = computed(() => {
    const range = this.currentRange();
    return range ? this.aggregate(range, this.resolvedGranularity()) : this.emptyData();
  });

  readonly previousData = computed(() => {
    const range = this.currentRange();
    if (!range) return this.emptyData();
    const duration = range.end.getTime() - range.start.getTime();
    const previousEnd = new Date(range.start.getTime() - 1);
    const previousStart = new Date(previousEnd.getTime() - duration);
    return this.aggregate({ start: previousStart, end: previousEnd }, this.resolvedGranularity());
  });

  readonly report = computed(() =>
    this.makeReport(this.currentData(), this.previousData(), this.selectedCategory()),
  );

  readonly kpis = computed<AnalyticsKpi[]>(() => {
    const report = this.report();
    const previous = this.makeReport(this.previousData(), this.emptyData(), this.selectedCategory());
    const revenueChange = this.percentChange(report.revenue, previous.revenue);
    const activityChange = this.percentChange(report.activity, previous.activity);
    const averageChange = this.percentChange(report.average, previous.average);
    const leading = report.topCategory;
    return [
      {
        label: 'Revenue',
        value: this.formatCurrency(report.revenue),
        detail: this.changeLabel(revenueChange),
        icon: '₹',
        trend: this.trend(revenueChange),
      },
      {
        label: 'Jobs & orders',
        value: report.activity.toLocaleString('en-IN'),
        detail: this.changeLabel(activityChange),
        icon: '↗',
        trend: this.trend(activityChange),
      },
      {
        label: 'Average value',
        value: this.formatCurrency(report.average),
        detail: this.changeLabel(averageChange),
        icon: '≈',
        trend: this.trend(averageChange),
      },
      {
        label: 'Top category',
        value: leading?.label ?? '—',
        detail: leading ? `${leading.share.toFixed(1)}% of total revenue` : 'No activity in this range',
        icon: '▦',
        trend: 'flat',
      },
    ];
  });

  readonly rangeLabel = computed(() => {
    const preset = this.selectedPreset();
    if (preset !== 'custom') return RANGE_PRESETS.find((item) => item.id === preset)?.label ?? '';
    const start = parseDateInput(this.startDate(), false);
    const end = parseDateInput(this.endDate(), true);
    if (!start || !end) return 'Custom date range';
    const formatDate = (date: Date) => date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    return `${formatDate(start)} – ${formatDate(end)}`;
  });

  readonly granularityLabel = computed(() =>
    GRANULARITIES.find((item) => item.id === this.resolvedGranularity())?.label ?? 'Daily',
  );

  categoryOptionLabel(categoryId: CategoryFilter): string {
    const categories = this.currentData().categories;
    const count = categoryId === 'all'
      ? categories.reduce((total, category) => total + category.activity, 0)
      : categories.find((category) => category.id === categoryId)?.activity ?? 0;
    const label = categoryId === 'all'
      ? 'All'
      : this.categoryOptions.find((category) => category.id === categoryId)?.label ?? '';
    return `${label} · ${count.toLocaleString('en-IN')}`;
  }

  selectPreset(preset: RangePreset): void {
    this.selectedPreset.set(preset);
    this.selectedGranularity.set('auto');
    const range = this.presetRange(preset);
    if (range) {
      this.startDate.set(dateInputValue(range.start));
      this.endDate.set(dateInputValue(range.end));
    }
  }

  selectPresetFromEvent(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) return;
    const preset = RANGE_PRESETS.find((item) => item.id === target.value);
    if (preset) this.selectPreset(preset.id);
  }

  selectCategory(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) return;
    const value = target.value;
    if (value === 'all' || REVENUE_CATEGORIES.some((category) => category.id === value)) {
      this.selectedCategory.set(value as CategoryFilter);
    }
  }

  selectGranularity(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) return;
    const value = target.value;
    if (GRANULARITIES.some((item) => item.id === value)) {
      this.selectedGranularity.set(value as Granularity);
    }
  }

  updateStartDate(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    this.startDate.set(target.value);
    this.selectedPreset.set('custom');
    this.selectedGranularity.set('auto');
  }

  updateEndDate(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    this.endDate.set(target.value);
    this.selectedPreset.set('custom');
    this.selectedGranularity.set('auto');
  }

  granularityDisabled(granularity: Granularity): boolean {
    if (granularity === 'auto') return false;
    const range = this.currentRange();
    return !range || bucketCount(range, granularity) > MAX_CHART_POINTS;
  }

  showAxisLabel(index: number): boolean {
    const length = this.report().points.length;
    if (length <= 8) return true;
    const step = Math.ceil(length / 8);
    return index % step === 0 || index === length - 1;
  }

  revenueHeight(value: number): number {
    const maximum = Math.max(...this.report().points.map((point) => point.revenue), 1);
    return value ? Math.max(3, Math.round((value / maximum) * 100)) : 0;
  }

  activityHeight(value: number): number {
    const maximum = Math.max(...this.report().points.map((point) => point.activity), 1);
    return value ? Math.max(3, Math.round((value / maximum) * 100)) : 0;
  }

  formatCurrency(value: number): string {
    return `₹${Math.round(value).toLocaleString('en-IN')}`;
  }

  formatCompactCurrency(value: number): string {
    return `₹${new Intl.NumberFormat('en-IN', {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value)}`;
  }

  pointTitle(point: AnalyticsPoint & BucketValue): string {
    return `${point.detail}: ${this.formatCurrency(point.revenue)} · ${point.activity} jobs/orders`;
  }

  activityPointTitle(point: AnalyticsPoint & BucketValue): string {
    return `${point.detail}: ${point.activity} jobs/orders`;
  }

  changeLabel(change: number | null): string {
    if (change === null) return 'New in this period';
    if (Math.abs(change) < 0.05) return 'No change vs previous period';
    return `${change > 0 ? '↑' : '↓'} ${Math.abs(change).toFixed(1)}% vs previous period`;
  }

  private presetRange(preset: RangePreset): DateRange | null {
    if (preset === 'custom') return null;
    const end = new Date(this.now);
    const start = new Date(end);
    if (preset === '24h') start.setTime(start.getTime() - DAY_MS);
    if (preset === '7d') start.setDate(start.getDate() - 7);
    if (preset === '30d') start.setDate(start.getDate() - 30);
    if (preset === '90d') start.setDate(start.getDate() - 90);
    if (preset === '12m') start.setFullYear(start.getFullYear() - 1);
    return { start, end };
  }

  private aggregate(range: DateRange, granularity: Exclude<Granularity, 'auto'>): AnalyticsData {
    const totals = emptyCategoryValues();
    const points: AnalyticsPoint[] = [];
    let cursor = startOfBucket(range.start, granularity);

    while (cursor < range.end && points.length < MAX_CHART_POINTS) {
      points.push({
        key: cursor.getTime(),
        label: this.bucketLabel(cursor, granularity),
        detail: cursor.toLocaleString('en-IN', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          ...(granularity === 'hour' ? { hour: 'numeric' } : {}),
        }),
        categories: emptyCategoryValues(),
      });
      cursor = nextBucket(cursor, granularity);
    }

    const pointByStart = new Map(points.map((point) => [point.key, point]));
    for (const event of this.operations.analyticsRecords()) {
      const eventDate = new Date(event.at);
      if (!Number.isFinite(eventDate.getTime()) ||
          eventDate < range.start || eventDate > range.end) continue;
      const point = pointByStart.get(startOfBucket(eventDate, granularity).getTime());
      if (!point) continue;
      const category = event.category as CategoryId;
      if (!Object.hasOwn(point.categories, category)) continue;
      point.categories[category].revenue += event.amount;
      point.categories[category].activity += 1;
      totals[category].revenue += event.amount;
      totals[category].activity += 1;
    }

    const revenue = REVENUE_CATEGORIES.reduce((sum, category) => sum + totals[category.id].revenue, 0);
    const activity = REVENUE_CATEGORIES.reduce((sum, category) => sum + totals[category.id].activity, 0);
    const categories = REVENUE_CATEGORIES.map((category) => {
      const value = totals[category.id];
      return {
        ...category,
        revenue: value.revenue,
        activity: value.activity,
        average: value.activity ? value.revenue / value.activity : 0,
        share: revenue ? (value.revenue / revenue) * 100 : 0,
        change: null,
      };
    }).filter((category) => category.revenue > 0 || category.activity > 0);

    return { revenue, activity, points, categories };
  }

  private makeReport(current: AnalyticsData, previous: AnalyticsData, filter: CategoryFilter): AnalyticsReport {
    const categories = current.categories
      .filter((category) => filter === 'all' || category.id === filter)
      .map((category) => {
        const previousValue = previous.categories.find((item) => item.id === category.id)?.revenue ?? 0;
        return { ...category, change: this.percentChange(category.revenue, previousValue) };
      });
    const revenue = categories.reduce((sum, category) => sum + category.revenue, 0);
    const activity = categories.reduce((sum, category) => sum + category.activity, 0);
    const points = current.points.map((point) => {
      const values = REVENUE_CATEGORIES
        .filter((category) => filter === 'all' || category.id === filter)
        .reduce((sum, category) => ({
          revenue: sum.revenue + point.categories[category.id].revenue,
          activity: sum.activity + point.categories[category.id].activity,
        }), { revenue: 0, activity: 0 });
      return { ...point, ...values };
    });
    const topCategory = [...categories].sort((a, b) => b.revenue - a.revenue)[0] ?? null;

    return {
      revenue,
      activity,
      average: activity ? revenue / activity : 0,
      categories: categories.sort((a, b) => b.revenue - a.revenue),
      points,
      topCategory,
    };
  }

  private emptyData(): AnalyticsData {
    return { revenue: 0, activity: 0, points: [], categories: [] };
  }

  private percentChange(current: number, previous: number): number | null {
    if (previous === 0) return current === 0 ? 0 : null;
    return ((current - previous) / previous) * 100;
  }

  private trend(change: number | null): AnalyticsKpi['trend'] {
    if (change === null || change > 0) return 'up';
    return change < 0 ? 'down' : 'flat';
  }

  private bucketLabel(date: Date, granularity: Exclude<Granularity, 'auto'>): string {
    if (granularity === 'hour') {
      const hour = date.getHours() % 12 || 12;
      return `${hour}${date.getHours() < 12 ? 'a' : 'p'}`;
    }
    if (granularity === 'month') return date.toLocaleDateString('en-IN', { month: 'short' });
    return String(date.getDate());
  }
}
