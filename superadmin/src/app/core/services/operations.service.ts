import { inject, Injectable, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { AdminApiService } from './admin-api.service';
import { AuthService } from './auth.service';
import type { PageKey } from '../models/user.model';

export type JobStatus = 'unassigned' | 'progress' | 'completed' | 'sla-risk';
export type JobPriority = 'low' | 'normal' | 'high' | 'critical';
export type JobStage = 'triage' | 'assigned' | 'scheduled' | 'on-site' | 'in-service' | 'quality-check';
export type DisputeStatus = 'open' | 'investigating' | 'resolved';
export type InvoiceType = 'customer' | 'partner';
export type InvoiceStatus = 'paid' | 'unpaid' | 'overdue';
export type ProjectStatus = 'requested' | 'in-production' | 'delivered';

export interface JobActivity {
  at: string;
  title: string;
  detail: string;
}

export interface JobChecklistItem {
  id: string;
  label: string;
  done: boolean;
}

export interface Job {
  id: string;
  company: string;
  service: string;
  partner: string | null;
  status: JobStatus;
  slaMinsLeft: number | null;
  amount: number;
  site: string;
  category?: string;
  priority?: JobPriority;
  requester?: string;
  contactPhone?: string;
  siteAddress?: string;
  asset?: string;
  issue?: string;
  workScope?: string;
  estimatedHours?: number;
  notes?: string;
  createdAt?: string;
  scheduledAt?: string;
  stage?: JobStage;
  checklist?: JobChecklistItem[];
  workNotes?: JobActivity[];
  activity?: JobActivity[];
}

export interface Partner {
  id: string;
  name: string;
  type: 'service' | 'repairing' | 'panelmaker' | 'supplier';
  rating: number;
  jobsDone: number;
  online: boolean;
  verified: boolean;
  city: string;
}

export interface VerificationRequest {
  id: string;
  name: string;
  type: string;
  documents: string[];
  appliedAt: string;
}

export interface Dispute {
  id: string;
  job: string;
  partner: string;
  reason: string;
  status: DisputeStatus;
  openedAt: string;
  amount: number;
}

export interface Company {
  name: string;
  gst: string;
  sites: number;
  users: number;
  amc: string;
  totalJobs: number;
  revenue: number;
}

export interface AmcContract {
  id: string;
  company: string;
  plan: string;
  expires: string;
  daysLeft: number;
  compliance: string;
  value: number | null;
}

export interface Payout {
  id: string;
  partner: string;
  period: string;
  jobs: number;
  amount: number;
  status: 'pending' | 'paid';
}

export interface Invoice {
  id: string;
  type: InvoiceType;
  party: string;
  amount: number;
  status: InvoiceStatus;
  due: string;
}

export interface InventoryItem {
  sku: string;
  name: string;
  category: string;
  stock: number;
  low: number;
  supplier: string | null;
}

export interface RepairTicket {
  id: string;
  device: string;
  partner: string | null;
  stage: 'received' | 'diagnosis' | 'repairing' | 'qc' | 'delivered';
  inAt: string;
  cost: number | null;
}

export interface ProjectRequest {
  id: string;
  company: string;
  title: string;
  panels: string;
  status: ProjectStatus;
  eta: string;
  value: number | null;
}

type SourceStatus = 'unknown' | 'loading' | 'connected' | 'not-connected' | 'error';

interface OperationsResponse<T> {
  items: T[];
  sourceStatus: 'connected' | 'not-connected';
  message?: string;
}

interface JobsResponse {
  jobs: Job[];
  partners: Partner[];
  sourceStatus: 'connected' | 'not-connected';
}

export interface AnalyticsEvent {
  at: string;
  amount: number;
  category: 'service' | 'repair' | 'amc' | 'ecart' | 'projects';
}

interface PartnerRoleCount {
  type: Partner['type'];
  count: number;
}

const JOB_STAGES: JobStage[] = [
  'triage',
  'assigned',
  'scheduled',
  'on-site',
  'in-service',
  'quality-check',
];

const JOB_CHECKLIST_TEMPLATE: Omit<JobChecklistItem, 'done'>[] = [
  { id: 'safety', label: 'Confirm site access and equipment isolation' },
  { id: 'scope', label: 'Complete the requested inspection or repair' },
  { id: 'handover', label: 'Record service findings and customer handover' },
];
@Injectable({ providedIn: 'root' })
export class OperationsService {
  private readonly api = inject(AdminApiService);
  private readonly auth = inject(AuthService);
  private started = false;
  private readonly _companies = signal<Company[]>([]);
  private readonly _amcs = signal<AmcContract[]>([]);
  private readonly _inventory = signal<InventoryItem[]>([]);
  private readonly analyticsEvents = signal<AnalyticsEvent[]>([]);
  private readonly sourceStatuses = signal<Record<string, SourceStatus>>({});
  readonly loadErrors = signal<Record<string, string>>({});
  readonly jobs = signal<Job[]>([]);
  readonly partners = signal<Partner[]>([]);
  readonly partnerRoleCounts = signal<PartnerRoleCount[]>([]);
  readonly verifications = signal<VerificationRequest[]>([]);
  readonly disputes = signal<Dispute[]>([]);
  readonly payouts = signal<Payout[]>([]);
  readonly invoices = signal<Invoice[]>([]);
  readonly repairs = signal<RepairTicket[]>([]);
  readonly projects = signal<ProjectRequest[]>([]);

  get operationErrors(): Array<[string, string]> {
    return Object.entries(this.loadErrors());
  }

  get companies(): Company[] {
    return this._companies();
  }

  get amcs(): AmcContract[] {
    return this._amcs();
  }

  get inventory(): InventoryItem[] {
    return this._inventory();
  }

  get revenueTrend(): Array<{ label: string; value: number }> {
    const now = new Date();
    const months = Array.from({ length: 6 }, (_, index) => {
      const month = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1);
      return {
        key: `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`,
        label: month.toLocaleDateString('en-IN', { month: 'short' }),
        value: 0,
      };
    });
    for (const event of this.analyticsEvents()) {
      const date = new Date(event.at);
      const point = months.find((month) =>
        month.key === `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
      );
      if (point && event.category === 'service') point.value += event.amount;
    }
    return months;
  }

  get peakHours(): Array<{ label: string; value: number }> {
    const ranges = [
      { label: '8-10', start: 8, end: 10 },
      { label: '10-12', start: 10, end: 12 },
      { label: '12-14', start: 12, end: 14 },
      { label: '14-16', start: 14, end: 16 },
      { label: '16-18', start: 16, end: 18 },
      { label: '18-20', start: 18, end: 20 },
    ];
    const events = this.analyticsEvents();
    return ranges.map((range) => ({
      label: range.label,
      value: events.filter((event) => {
        const hour = new Date(event.at).getHours();
        return hour >= range.start && hour < range.end;
      }).length,
    }));
  }

  get categoryRevenue(): Array<{ label: string; value: number }> {
    const labels: Record<AnalyticsEvent['category'], string> = {
      service: 'Service earnings',
      repair: 'Repairs',
      amc: 'AMC',
      ecart: 'Paid orders',
      projects: 'Projects',
    };
    const totals = new Map<AnalyticsEvent['category'], number>();
    for (const event of this.analyticsEvents()) {
      totals.set(event.category, (totals.get(event.category) ?? 0) + event.amount);
    }
    return [...totals].map(([category, value]) => ({ label: labels[category], value }));
  }

  loadAuthorizedData(): void {
    if (this.started) return;
    this.started = true;
    const domains: Array<{ domain: string; page: PageKey }> = [
      { domain: 'jobs', page: 'jobs' },
      { domain: 'livemonitor', page: 'livemonitor' },
      { domain: 'partner-app', page: 'partner-app' },
      { domain: 'verification', page: 'verification' },
      { domain: 'disputes', page: 'disputes' },
      { domain: 'companies', page: 'companies' },
      { domain: 'amc', page: 'amc' },
      { domain: 'finance', page: 'finance' },
      { domain: 'invoices', page: 'invoices' },
      { domain: 'inventory', page: 'inventory' },
      { domain: 'repair', page: 'repair' },
      { domain: 'projects', page: 'projects' },
      { domain: 'analytics', page: 'analytics' },
    ];
    const permitted = domains.filter(({ page }) => this.auth.canAccess(page));
    const hasJobsAccess = permitted.some(({ domain }) => domain === 'jobs');
    void Promise.all(permitted
      .filter(({ domain }) => !(domain === 'livemonitor' && hasJobsAccess))
      .map(({ domain }) => this.loadDomain(domain)));
  }

  sourceStatus(domain: string): SourceStatus {
    return this.sourceStatuses()[domain] ?? 'unknown';
  }

  analyticsRecords(): AnalyticsEvent[] {
    return this.analyticsEvents();
  }

  private async loadDomain(domain: string): Promise<void> {
    this.sourceStatuses.update((statuses) => ({ ...statuses, [domain]: 'loading' }));
    try {
      if (domain === 'jobs' || domain === 'livemonitor') {
        const result = await this.api.getOperations<JobsResponse>(domain);
        this.jobs.set(result.jobs);
        this.partners.set(result.partners);
        this.sourceStatuses.update((statuses) => ({
          ...statuses,
          jobs: result.sourceStatus,
          livemonitor: result.sourceStatus,
        }));
        return;
      }
      if (domain === 'partner-app') {
        const result = await this.api.getOperations<OperationsResponse<PartnerRoleCount>>(domain);
        this.partnerRoleCounts.set(result.items);
        this.sourceStatuses.update((statuses) => ({ ...statuses, [domain]: result.sourceStatus }));
        return;
      }
      if (domain === 'analytics') {
        const result = await this.api.getOperations<OperationsResponse<AnalyticsEvent>>(domain);
        this.analyticsEvents.set(result.items);
        this.sourceStatuses.update((statuses) => ({ ...statuses, analytics: result.sourceStatus }));
        return;
      }
      const result = await this.api.getOperations<OperationsResponse<
        VerificationRequest | Dispute | Company | AmcContract | Payout | Invoice |
        InventoryItem | RepairTicket | ProjectRequest
      >>(domain);
      this.sourceStatuses.update((statuses) => ({ ...statuses, [domain]: result.sourceStatus }));
      if (domain === 'verification') this.verifications.set(result.items as VerificationRequest[]);
      if (domain === 'disputes') this.disputes.set(result.items as Dispute[]);
      if (domain === 'companies') this._companies.set(result.items as Company[]);
      if (domain === 'amc') this._amcs.set(result.items as AmcContract[]);
      if (domain === 'finance') this.payouts.set(result.items as Payout[]);
      if (domain === 'invoices') this.invoices.set(result.items as Invoice[]);
      if (domain === 'inventory') this._inventory.set(result.items as InventoryItem[]);
      if (domain === 'repair') this.repairs.set(result.items as RepairTicket[]);
      if (domain === 'projects') this.projects.set(result.items as ProjectRequest[]);
    } catch (error) {
      const message = error instanceof HttpErrorResponse && typeof error.error?.message === 'string'
        ? error.error.message
        : error instanceof Error ? error.message : 'Operations data could not be loaded.';
      this.sourceStatuses.update((statuses) => ({ ...statuses, [domain]: 'error' }));
      this.loadErrors.update((errors) => ({ ...errors, [domain]: message }));
      console.error(`Unable to load Superadmin operations data for ${domain}.`, error);
    }
  }

  /* -------- dashboard aggregates -------- */
  readonly liveJobs = () => this.jobs().filter((j) => j.status === 'progress' || j.status === 'unassigned' || j.status === 'sla-risk');
  readonly slaRiskJobs = () => this.jobs().filter((j) => j.status === 'sla-risk');
  readonly partnersOnline = () => this.partners().filter((p) => p.online);
  readonly pendingApprovals = () => this.verifications().length;
  readonly openDisputes = () => this.disputes().filter((d) => d.status !== 'resolved');
  readonly pendingPayouts = () => this.payouts().filter((p) => p.status === 'pending');
  readonly pendingPayoutTotal = () => this.pendingPayouts().reduce((n, p) => n + p.amount, 0);
  readonly monthRevenue = () => this.revenueTrend.at(-1)?.value ?? 0;
  readonly todayServiceEarnings = () => {
    const today = new Date().toISOString().slice(0, 10);
    return this.analyticsEvents()
      .filter((event) => event.category === 'service' && event.at.slice(0, 10) === today)
      .reduce((total, event) => total + event.amount, 0);
  };
  readonly lowStockItems = () => this.inventory.filter((i) => i.stock <= i.low);
  readonly inventorySuppliers = () =>
    new Set(this.inventory.map((item) => item.supplier).filter((supplier) => supplier && supplier !== '—')).size;
  readonly activeRepairs = () => this.repairs().filter((r) => r.stage !== 'delivered');
  readonly expiringAmcs = () => this.amcs.filter((a) => a.daysLeft <= 30);

  /* -------- actions (superadmin workflows) -------- */

  assignJob(jobId: string, partnerName: string | null): void {
    const at = new Date().toISOString();
    this.jobs.update((list) =>
      list.map((job) => {
        if (job.id !== jobId || job.status === 'completed' || job.partner === partnerName) return job;
        const title = partnerName ? (job.partner ? 'Partner reassigned' : 'Partner assigned') : 'Partner unassigned';
        const detail = partnerName
          ? `${partnerName} ${job.partner ? 'is now responsible for' : 'accepted'} this job.`
          : `${job.partner ?? 'The assigned partner'} was removed from this job.`;
        return {
          ...job,
          partner: partnerName,
          status: partnerName ? 'progress' : 'unassigned',
          stage: partnerName
            ? job.stage && job.stage !== 'triage' ? job.stage : 'assigned'
            : job.stage === 'assigned' ? 'triage' : job.stage,
          slaMinsLeft: partnerName ? (job.slaMinsLeft ?? 120) : job.slaMinsLeft,
          activity: [...(job.activity ?? []), { at, title, detail }],
        };
      }),
    );
  }

  jobStage(job: Job): JobStage | 'completed' {
    if (job.status === 'completed') return 'completed';
    if (job.stage) return job.stage;
    if (job.scheduledAt) return 'scheduled';
    return job.partner ? 'assigned' : 'triage';
  }

  nextJobStage(job: Job): JobStage | null {
    const currentStage = this.jobStage(job);
    if (currentStage === 'completed') return null;
    const currentIndex = JOB_STAGES.indexOf(currentStage);
    if (currentIndex < 0) return null;
    const nextIndex = currentIndex + 1;
    return JOB_STAGES[nextIndex] ?? null;
  }

  canAdvanceJobStage(job: Job): boolean {
    const nextStage = this.nextJobStage(job);
    return !!nextStage &&
      !!job.partner &&
      (nextStage !== 'scheduled' || !!job.scheduledAt);
  }

  advanceJobStage(jobId: string): boolean {
    const at = new Date().toISOString();
    let updated = false;
    this.jobs.update((list) => list.map((job) => {
      if (job.id !== jobId || !this.canAdvanceJobStage(job)) return job;
      const stage = this.nextJobStage(job);
      if (!stage) return job;
      updated = true;
      return {
        ...job,
        stage,
        status: job.status === 'sla-risk' ? 'sla-risk' : 'progress',
        activity: [...(job.activity ?? []), {
          at,
          title: 'Stage advanced',
          detail: `Service delivery moved to ${this.stageLabel(stage)}.`,
        }],
      };
    }));
    return updated;
  }

  scheduleJob(jobId: string, scheduledAt: string): boolean {
    const date = new Date(scheduledAt);
    if (!Number.isFinite(date.getTime())) return false;
    const at = new Date().toISOString();
    let updated = false;
    this.jobs.update((list) => list.map((job) => {
      if (job.id !== jobId || job.status === 'completed') return job;
      updated = true;
      const stage = this.jobStage(job);
      return {
        ...job,
        scheduledAt: date.toISOString(),
        stage: stage === 'triage' || stage === 'assigned' ? 'scheduled' : job.stage,
        activity: [...(job.activity ?? []), {
          at,
          title: 'Visit scheduled',
          detail: `Service visit scheduled for ${date.toLocaleString()}.`,
        }],
      };
    }));
    return updated;
  }

  jobChecklist(job: Job): JobChecklistItem[] {
    return job.checklist ?? JOB_CHECKLIST_TEMPLATE.map((item) => ({ ...item, done: false }));
  }

  toggleJobChecklistItem(jobId: string, itemId: string): boolean {
    const at = new Date().toISOString();
    let updated = false;
    this.jobs.update((list) => list.map((job) => {
      if (job.id !== jobId || job.status === 'completed') return job;
      const currentChecklist = this.jobChecklist(job);
      const currentItem = currentChecklist.find((entry) => entry.id === itemId);
      if (!currentItem) return job;
      updated = true;
      const item = { ...currentItem, done: !currentItem.done };
      const checklist = currentChecklist.map((entry) => entry.id === itemId
        ? item
        : entry);
      return {
        ...job,
        checklist,
        activity: [...(job.activity ?? []), {
          at,
          title: 'Checklist updated',
          detail: `${item.label} marked ${item.done ? 'complete' : 'incomplete'}.`,
        }],
      };
    }));
    return updated;
  }

  addJobWorkNote(jobId: string, note: string): boolean {
    const trimmed = note.trim();
    if (!trimmed || trimmed.length > 500) return false;
    const at = new Date().toISOString();
    let updated = false;
    this.jobs.update((list) => list.map((job) => {
      if (job.id !== jobId) return job;
      updated = true;
      const entry = { at, title: 'Work note', detail: trimmed };
      return {
        ...job,
        workNotes: [...(job.workNotes ?? []), entry],
        activity: [...(job.activity ?? []), entry],
      };
    }));
    return updated;
  }

  stageLabel(stage: JobStage | 'completed'): string {
    const labels: Record<JobStage | 'completed', string> = {
      triage: 'Triage',
      assigned: 'Partner assigned',
      scheduled: 'Visit scheduled',
      'on-site': 'On site',
      'in-service': 'In service',
      'quality-check': 'Quality check',
      completed: 'Completed',
    };
    return labels[stage];
  }

  completeJob(jobId: string): void {
    const at = new Date().toISOString();
    this.jobs.update((list) =>
      list.map((job) => job.id === jobId && job.status !== 'completed'
        ? {
            ...job,
            status: 'completed' as const,
            slaMinsLeft: null,
            activity: [...(job.activity ?? []), { at, title: 'Job completed', detail: 'The job was marked complete by an administrator.' }],
          }
        : job),
    );
  }

  approvePartner(id: string): void {
    this.verifications.update((list) => list.filter((v) => v.id !== id));
  }

  rejectPartner(id: string): void {
    this.verifications.update((list) => list.filter((v) => v.id !== id));
  }

  resolveDispute(id: string, resolution: DisputeStatus): void {
    this.disputes.update((list) => list.map((d) => (d.id === id ? { ...d, status: resolution } : d)));
  }

  markInvoicePaid(id: string): void {
    this.invoices.update((list) => list.map((i) => (i.id === id ? { ...i, status: 'paid' as const } : i)));
  }
}
