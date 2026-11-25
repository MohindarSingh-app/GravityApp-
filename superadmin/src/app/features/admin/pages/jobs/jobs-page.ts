import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  OperationsService,
  type Job,
  type JobActivity,
  type JobStage,
} from '../../../../core/services/operations.service';

type JobFilter = 'all' | 'unassigned' | 'sla-risk' | 'progress' | 'completed';
type JobSort = 'urgency' | 'sla' | 'amount' | 'newest';

@Component({
  selector: 'app-jobs-page',
  imports: [],
  templateUrl: './jobs-page.html',
  styleUrl: './jobs-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JobsPage {
  readonly ops = inject(OperationsService);
  readonly activeFilter = signal<JobFilter>('all');
  readonly searchTerm = signal('');
  readonly sortBy = signal<JobSort>('urgency');
  readonly selectedJobId = signal<string | null>(null);
  readonly scheduleNotice = signal<string | null>(null);
  readonly workNoteDraft = signal('');
  readonly workNoteError = signal<string | null>(null);
  readonly workNoteNotice = signal<string | null>(null);
  readonly deliveryStages: JobStage[] = [
    'triage',
    'assigned',
    'scheduled',
    'on-site',
    'in-service',
    'quality-check',
  ];

  readonly filters: { value: JobFilter; label: string }[] = [
    { value: 'all', label: 'All jobs' },
    { value: 'unassigned', label: 'Unassigned' },
    { value: 'sla-risk', label: 'SLA risk' },
    { value: 'progress', label: 'In progress' },
    { value: 'completed', label: 'Completed' },
  ];

  readonly metrics = computed(() => {
    const jobs = this.ops.jobs();
    const active = jobs.filter((job) => job.status !== 'completed');
    return [
      { label: 'Open jobs', value: String(active.length), detail: 'Awaiting or in delivery', tone: 'blue' },
      { label: 'Needs attention', value: String(active.filter((job) => this.isSlaRisk(job)).length), detail: 'At or near SLA breach', tone: 'red' },
      { label: 'Unassigned', value: String(active.filter((job) => !job.partner).length), detail: 'No service partner yet', tone: 'amber' },
      { label: 'Open value', value: this.formatCurrency(active.reduce((sum, job) => sum + job.amount, 0)), detail: 'Estimated work in queue', tone: 'green' },
    ];
  });

  readonly filteredJobs = computed(() => {
    const search = this.searchTerm().trim().toLocaleLowerCase();
    const filter = this.activeFilter();
    const jobs = this.ops.jobs().filter((job) => {
      const matchesFilter = filter === 'all'
        || (filter === 'unassigned' && job.status !== 'completed' && !job.partner)
        || (filter === 'sla-risk' && this.isSlaRisk(job))
        || job.status === filter;
      const searchable = [
        job.id, job.company, job.site, job.siteAddress, job.service, job.category,
        job.partner, job.requester, job.asset, job.issue,
      ].filter(Boolean).join(' ').toLocaleLowerCase();
      return matchesFilter && (!search || searchable.includes(search));
    });

    return jobs.sort((left, right) => {
      switch (this.sortBy()) {
        case 'sla':
          return (left.slaMinsLeft ?? Number.MAX_SAFE_INTEGER) - (right.slaMinsLeft ?? Number.MAX_SAFE_INTEGER);
        case 'amount':
          return right.amount - left.amount;
        case 'newest':
          return (right.createdAt ?? '').localeCompare(left.createdAt ?? '');
        default:
          return this.urgencyRank(left) - this.urgencyRank(right)
            || (left.slaMinsLeft ?? Number.MAX_SAFE_INTEGER) - (right.slaMinsLeft ?? Number.MAX_SAFE_INTEGER);
      }
    });
  });

  readonly selectedJob = computed(
    () => this.ops.jobs().find((job) => job.id === this.selectedJobId()) ?? null,
  );

  setFilter(filter: JobFilter): void {
    this.activeFilter.set(filter);
  }

  setSearch(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }

  setSort(event: Event): void {
    this.sortBy.set((event.target as HTMLSelectElement).value as JobSort);
  }

  count(filter: JobFilter): number {
    const jobs = this.ops.jobs();
    if (filter === 'all') return jobs.length;
    if (filter === 'unassigned') return jobs.filter((job) => job.status !== 'completed' && !job.partner).length;
    if (filter === 'sla-risk') return jobs.filter((job) => this.isSlaRisk(job)).length;
    return jobs.filter((job) => job.status === filter).length;
  }

  partnerOptions() {
    return this.ops.partners().filter((partner) => partner.type !== 'supplier');
  }

  assign(jobId: string, event: Event): void {
    this.ops.assignJob(jobId, (event.target as HTMLSelectElement).value || null);
  }

  complete(jobId: string): void {
    this.ops.completeJob(jobId);
  }

  openDetails(jobId: string): void {
    this.scheduleNotice.set(null);
    this.workNoteDraft.set('');
    this.workNoteError.set(null);
    this.workNoteNotice.set(null);
    this.selectedJobId.set(jobId);
  }

  closeDetails(): void {
    this.selectedJobId.set(null);
  }

  scheduleJob(jobId: string, value: string): void {
    if (!value) {
      this.scheduleNotice.set('Choose a visit date and time.');
      return;
    }
    const date = new Date(value);
    if (!Number.isFinite(date.getTime()) || !this.ops.scheduleJob(jobId, date.toISOString())) {
      this.scheduleNotice.set('The visit time could not be saved. Check the date and try again.');
      return;
    }
    this.scheduleNotice.set('Visit schedule saved for this session.');
  }

  scheduleInputValue(value: string | undefined): string {
    if (!value) return '';
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return '';
    return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
      .toISOString()
      .slice(0, 16);
  }

  advanceStage(jobId: string): void {
    this.ops.advanceJobStage(jobId);
  }

  stageIndex(job: Job): number {
    const stage = this.ops.jobStage(job);
    return stage === 'completed' ? this.deliveryStages.length : this.deliveryStages.indexOf(stage);
  }

  completedChecklistCount(job: Job): number {
    return this.ops.jobChecklist(job).filter((item) => item.done).length;
  }

  stageRequirement(job: Job): string | null {
    if (job.status === 'completed') return null;
    const next = this.ops.nextJobStage(job);
    if (!next) return 'Final quality check is ready. Mark the job complete after handover.';
    if (!job.partner) return 'Assign a service partner before progressing delivery.';
    if (next === 'scheduled' && !job.scheduledAt) return 'Save a visit schedule before progressing delivery.';
    return null;
  }

  setWorkNoteDraft(event: Event): void {
    this.workNoteDraft.set((event.target as HTMLTextAreaElement).value);
    this.workNoteError.set(null);
    this.workNoteNotice.set(null);
  }

  addWorkNote(jobId: string): void {
    const note = this.workNoteDraft().trim();
    if (!note) {
      this.workNoteError.set('Enter a work note before saving.');
      return;
    }
    if (!this.ops.addJobWorkNote(jobId, note)) {
      this.workNoteError.set('The work note could not be saved. Keep it under 500 characters.');
      return;
    }
    this.workNoteDraft.set('');
    this.workNoteError.set(null);
    this.workNoteNotice.set('Work note saved for this session.');
  }

  activity(job: Job): JobActivity[] {
    return [...(job.activity ?? [])].reverse();
  }

  statusLabel(job: Job): string {
    if (job.status === 'sla-risk') return 'SLA risk';
    if (job.status === 'progress') return 'In progress';
    if (job.status === 'completed') return 'Completed';
    return 'Unassigned';
  }

  priorityLabel(job: Job): string {
    const priority = job.priority ?? 'normal';
    return priority.charAt(0).toUpperCase() + priority.slice(1);
  }

  slaPercent(job: Job): number {
    if (job.slaMinsLeft === null) return 100;
    return Math.max(4, Math.min(100, Math.round((job.slaMinsLeft / 120) * 100)));
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  }

  formatDate(value: string | undefined): string {
    if (!value) return '—';
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(value));
  }

  isSlaRisk(job: Job): boolean {
    return job.status !== 'completed'
      && (job.status === 'sla-risk' || (job.slaMinsLeft !== null && job.slaMinsLeft <= 10));
  }

  private urgencyRank(job: Job): number {
    if (this.isSlaRisk(job)) return 0;
    if (job.status === 'unassigned' || !job.partner) return 1;
    if (job.status === 'completed') return 3;
    return 2;
  }
}
