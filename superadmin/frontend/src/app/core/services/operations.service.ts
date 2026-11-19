import { Injectable, signal } from '@angular/core';

/* ============================================================
   OperationsService — platform operations data (mock layer)
   Data model mapped from exampeal.html (Operations Console).
   Backend connect karte waqt har method ko HTTP call se
   replace karna hai — shapes same rakhna.
   ============================================================ */

export type JobStatus = 'unassigned' | 'progress' | 'completed' | 'sla-risk';
export type DisputeStatus = 'open' | 'investigating' | 'resolved';
export type InvoiceType = 'customer' | 'partner';
export type InvoiceStatus = 'paid' | 'unpaid' | 'overdue';
export type ProjectStatus = 'requested' | 'in-production' | 'delivered';

export interface Job {
  id: string;
  company: string;
  service: string;
  partner: string | null;
  status: JobStatus;
  slaMinsLeft: number | null;
  amount: number;
  site: string;
}

export interface Partner {
  id: string;
  name: string;
  type: 'service' | 'repairing' | 'panelmaker' | 'supplier';
  rating: number;
  jobsDone: number;
  earnings: number;
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
  value: number;
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
  supplier: string;
}

export interface RepairTicket {
  id: string;
  device: string;
  partner: string;
  stage: 'received' | 'diagnosis' | 'repairing' | 'qc' | 'delivered';
  inAt: string;
  cost: number;
}

export interface ProjectRequest {
  id: string;
  company: string;
  title: string;
  panels: number;
  status: ProjectStatus;
  eta: string;
  value: number;
}

/* ---------------- seed data (exampeal.html se) ---------------- */

const JOBS: Job[] = [
  { id: 'EC-IND-0140', company: 'Sharma Textiles', service: 'VFD Repair', partner: null, status: 'sla-risk', slaMinsLeft: 3, amount: 4200, site: 'Unit-2 Jaipur' },
  { id: 'EC-IND-0139', company: 'Rajput Metals', service: 'SCADA Checkup', partner: 'Suresh Kumar', status: 'progress', slaMinsLeft: 40, amount: 6500, site: 'Plant-A' },
  { id: 'EC-IND-0138', company: 'Marble House', service: 'Panel Service', partner: 'Deepak Electricals', status: 'progress', slaMinsLeft: 85, amount: 3100, site: 'Sanganer' },
  { id: 'EC-IND-0137', company: 'Sharma Textiles', service: 'PLC Troubleshoot', partner: 'Amit Panels', status: 'progress', slaMinsLeft: 120, amount: 8900, site: 'Unit-1' },
  { id: 'EC-IND-0136', company: 'Gupta Foods', service: 'Emergency Call', partner: 'Ravi Powerworks', status: 'completed', slaMinsLeft: null, amount: 1500, site: 'VKI Area' },
  { id: 'EC-IND-0135', company: 'Rajput Metals', service: 'Panel Fabrication', partner: 'Amit Panels', status: 'completed', slaMinsLeft: null, amount: 42000, site: 'Plant-B' },
  { id: 'EC-IND-0134', company: 'Marble House', service: 'Motor Winding', partner: 'JEE Motors', status: 'completed', slaMinsLeft: null, amount: 5400, site: 'Sanganer' },
];

const PARTNERS: Partner[] = [
  { id: 'p1', name: 'Suresh Kumar', type: 'service', rating: 4.9, jobsDone: 312, earnings: 184000, online: true, verified: true, city: 'Jaipur' },
  { id: 'p2', name: 'Deepak Electricals & Repairs', type: 'repairing', rating: 4.7, jobsDone: 208, earnings: 142500, online: true, verified: true, city: 'Jaipur' },
  { id: 'p3', name: 'Amit Panels', type: 'panelmaker', rating: 4.8, jobsDone: 96, earnings: 421000, online: true, verified: true, city: 'Jodhpur' },
  { id: 'p4', name: 'JEE Motors', type: 'repairing', rating: 4.5, jobsDone: 175, earnings: 98700, online: false, verified: true, city: 'Jaipur' },
  { id: 'p5', name: 'Ravi Powerworks', type: 'service', rating: 4.6, jobsDone: 254, earnings: 156300, online: true, verified: true, city: 'Ajmer' },
  { id: 'p6', name: 'Shree Electric Suppliers', type: 'supplier', rating: 4.4, jobsDone: 61, earnings: 289000, online: false, verified: true, city: 'Jaipur' },
  { id: 'p7', name: 'Manish Automation', type: 'service', rating: 4.8, jobsDone: 143, earnings: 121000, online: true, verified: true, city: 'Jaipur' },
  { id: 'p8', name: 'Kisan Controls', type: 'panelmaker', rating: 4.2, jobsDone: 38, earnings: 167500, online: false, verified: false, city: 'Kota' },
];

const VERIFICATIONS: VerificationRequest[] = [
  { id: 'v1', name: 'Deepak Electricals & Repairs', type: 'Repairing Partner', documents: ['GST Certificate', 'Aadhaar', 'Workshop Photos'], appliedAt: '5 hours ago' },
  { id: 'v2', name: 'Kisan Controls', type: 'Panel Maker', documents: ['GST Certificate', 'Udyam Registration'], appliedAt: '1 day ago' },
  { id: 'v3', name: 'Vikas Singh', type: 'Service Partner', documents: ['Aadhaar', 'ITI Certificate', 'Police Verification'], appliedAt: '2 days ago' },
];

const DISPUTES: Dispute[] = [
  { id: 'd1', job: 'EC-IND-0129', partner: 'JEE Motors', reason: 'Repair not done, VFD tripped again', status: 'open', openedAt: '1 day ago', amount: 5400 },
  { id: 'd2', job: 'EC-IND-0121', partner: 'Shree Electric Suppliers', reason: 'Wrong part delivered', status: 'open', openedAt: '2 days ago', amount: 12800 },
  { id: 'd3', job: 'EC-IND-0117', partner: 'Ravi Powerworks', reason: 'Late arrival — SLA missed', status: 'investigating', openedAt: '3 days ago', amount: 2200 },
  { id: 'd4', job: 'EC-IND-0109', partner: 'Amit Panels', reason: 'Panel dimension mismatch', status: 'resolved', openedAt: '1 week ago', amount: 9500 },
];

const COMPANIES: Company[] = [
  { name: 'Sharma Textiles Pvt. Ltd.', gst: '08AABCS1429B1Z1', sites: 4, users: 11, amc: 'Active', totalJobs: 68, revenue: 486000 },
  { name: 'Rajput Metals & Alloys', gst: '08AAECR9821M1ZK', sites: 2, users: 6, amc: 'Active', totalJobs: 41, revenue: 312000 },
  { name: 'Marble House Industries', gst: '08AAJCM4410F1ZQ', sites: 3, users: 8, amc: 'Expiring', totalJobs: 35, revenue: 198500 },
  { name: 'Gupta Foods Processing', gst: '08AAGCG2218D1Z4', sites: 1, users: 3, amc: 'None', totalJobs: 12, revenue: 46200 },
];

const AMCS: AmcContract[] = [
  { id: 'AMC-2024-003', company: 'Marble House Industries', plan: 'Standard — Quarterly', expires: '2026-11-13', daysLeft: 9, compliance: '2 visits pending', value: 66000 },
  { id: 'AMC-2024-001', company: 'Sharma Textiles Pvt. Ltd.', plan: 'Premium — Monthly', expires: '2027-03-31', daysLeft: 147, compliance: 'On track', value: 144000 },
  { id: 'AMC-2024-002', company: 'Rajput Metals & Alloys', plan: 'Standard — Quarterly', expires: '2027-01-15', daysLeft: 72, compliance: 'On track', value: 48000 },
];

const PAYOUTS: Payout[] = [
  { id: 'PO-2201', partner: 'Suresh Kumar', period: 'Oct Week 4', jobs: 22, amount: 34500, status: 'pending' },
  { id: 'PO-2200', partner: 'Deepak Electricals', period: 'Oct Week 4', jobs: 14, amount: 21800, status: 'pending' },
  { id: 'PO-2199', partner: 'Amit Panels', period: 'Oct Week 3', jobs: 6, amount: 58500, status: 'pending' },
  { id: 'PO-2198', partner: 'JEE Motors', period: 'Oct Week 3', jobs: 11, amount: 16400, status: 'paid' },
  { id: 'PO-2197', partner: 'Ravi Powerworks', period: 'Oct Week 3', jobs: 18, amount: 27200, status: 'paid' },
];

const INVOICES: Invoice[] = [
  { id: 'INV-C-0512', type: 'customer', party: 'Sharma Textiles', amount: 42000, status: 'paid', due: 'Paid 12 Oct' },
  { id: 'INV-C-0513', type: 'customer', party: 'Rajput Metals', amount: 6500, status: 'unpaid', due: 'Due 5 Nov' },
  { id: 'INV-C-0514', type: 'customer', party: 'Marble House', amount: 9800, status: 'overdue', due: 'Overdue 6 days' },
  { id: 'INV-P-0091', type: 'partner', party: 'Suresh Kumar', amount: 34500, status: 'unpaid', due: 'Payout Fri' },
  { id: 'INV-P-0092', type: 'partner', party: 'Deepak Electricals', amount: 21800, status: 'unpaid', due: 'Payout Fri' },
  { id: 'INV-P-0093', type: 'partner', party: 'Amit Panels', amount: 58500, status: 'paid', due: 'Paid 28 Oct' },
];

const INVENTORY: InventoryItem[] = [
  { sku: 'SKU-1001', name: 'VFD 5HP Delta', category: 'Drives', stock: 4, low: 5, supplier: 'Shree Electric Suppliers' },
  { sku: 'SKU-1002', name: 'Contactor 32A L&T', category: 'Switchgear', stock: 38, low: 10, supplier: 'Shree Electric Suppliers' },
  { sku: 'SKU-1003', name: 'PLC S7-1200 CPU', category: 'Automation', stock: 2, low: 3, supplier: 'Manish Automation' },
  { sku: 'SKU-1004', name: 'Copper Wire 2.5mm (100m)', category: 'Cables', stock: 12, low: 6, supplier: 'Shree Electric Suppliers' },
  { sku: 'SKU-1005', name: 'SMPS 24V 10A', category: 'Power', stock: 9, low: 4, supplier: 'Kisan Controls' },
];

const REPAIRS: RepairTicket[] = [
  { id: 'RP-3301', device: 'VFD ABB 10HP', partner: 'Deepak Electricals', stage: 'repairing', inAt: '2 days ago', cost: 6500 },
  { id: 'RP-3302', device: 'Servo Motor 2kW', partner: 'JEE Motors', stage: 'diagnosis', inAt: '1 day ago', cost: 4200 },
  { id: 'RP-3303', device: 'PLC HMI Panel', partner: 'Deepak Electricals', stage: 'qc', inAt: '3 days ago', cost: 11800 },
  { id: 'RP-3304', device: 'Soft Starter 30HP', partner: 'JEE Motors', stage: 'received', inAt: 'Today', cost: 8200 },
  { id: 'RP-3305', device: 'VFD Delta 5HP', partner: 'Deepak Electricals', stage: 'delivered', inAt: '4 days ago', cost: 3900 },
];

const PROJECTS: ProjectRequest[] = [
  { id: 'PR-104', company: 'Rajput Metals & Alloys', title: ' MCC Panel 8-feeder', panels: 2, status: 'in-production', eta: '18 Nov', value: 168000 },
  { id: 'PR-103', company: 'Sharma Textiles', title: 'APFC Panel 100kVAR', panels: 1, status: 'requested', eta: '—', value: 84000 },
  { id: 'PR-102', company: 'Marble House', title: 'PDB Panel Upgrade', panels: 3, status: 'delivered', eta: 'Delivered 28 Oct', value: 142000 },
];

const REVENUE_TREND = [
  { label: 'May', value: 168000 },
  { label: 'Jun', value: 182000 },
  { label: 'Jul', value: 205000 },
  { label: 'Aug', value: 196000 },
  { label: 'Sep', value: 218000 },
  { label: 'Oct', value: 242000 },
];

const PEAK_HOURS = [
  { label: '8-10', value: 12 },
  { label: '10-12', value: 26 },
  { label: '12-14', value: 18 },
  { label: '14-16', value: 31 },
  { label: '16-18', value: 24 },
  { label: '18-20', value: 9 },
];

const CATEGORY_REVENUE = [
  { label: 'Electrical', value: 96000 },
  { label: 'SCADA/PLC', value: 68000 },
  { label: 'VFD Repair', value: 42000 },
  { label: 'Panels', value: 28000 },
  { label: 'AMC', value: 8000 },
];

@Injectable({ providedIn: 'root' })
export class OperationsService {
  /* -------- live signals -------- */
  readonly jobs = signal<Job[]>(JOBS);
  readonly partners = signal<Partner[]>(PARTNERS);
  readonly verifications = signal<VerificationRequest[]>(VERIFICATIONS);
  readonly disputes = signal<Dispute[]>(DISPUTES);
  readonly payouts = signal<Payout[]>(PAYOUTS);
  readonly invoices = signal<Invoice[]>(INVOICES);
  readonly repairs = signal<RepairTicket[]>(REPAIRS);
  readonly projects = signal<ProjectRequest[]>(PROJECTS);

  readonly companies = COMPANIES;
  readonly amcs = AMCS;
  readonly inventory = INVENTORY;
  readonly revenueTrend = REVENUE_TREND;
  readonly peakHours = PEAK_HOURS;
  readonly categoryRevenue = CATEGORY_REVENUE;

  /* -------- dashboard aggregates -------- */
  readonly liveJobs = () => this.jobs().filter((j) => j.status === 'progress' || j.status === 'unassigned' || j.status === 'sla-risk');
  readonly slaRiskJobs = () => this.jobs().filter((j) => j.status === 'sla-risk');
  readonly partnersOnline = () => this.partners().filter((p) => p.online);
  readonly pendingApprovals = () => this.verifications().length;
  readonly openDisputes = () => this.disputes().filter((d) => d.status !== 'resolved');
  readonly pendingPayouts = () => this.payouts().filter((p) => p.status === 'pending');
  readonly pendingPayoutTotal = () => this.pendingPayouts().reduce((n, p) => n + p.amount, 0);
  readonly monthRevenue = () => this.revenueTrend[this.revenueTrend.length - 1].value;
  readonly lowStockItems = () => this.inventory.filter((i) => i.stock <= i.low);
  readonly activeRepairs = () => this.repairs().filter((r) => r.stage !== 'delivered');
  readonly expiringAmcs = () => this.amcs.filter((a) => a.daysLeft <= 30);

  /* -------- actions (superadmin workflows) -------- */

  assignJob(jobId: string, partnerName: string): void {
    this.jobs.update((list) =>
      list.map((j) => (j.id === jobId ? { ...j, partner: partnerName, status: 'progress' as const, slaMinsLeft: j.slaMinsLeft ?? 120 } : j)),
    );
  }

  completeJob(jobId: string): void {
    this.jobs.update((list) => list.map((j) => (j.id === jobId ? { ...j, status: 'completed' as const, slaMinsLeft: null } : j)));
  }

  approvePartner(id: string): void {
    const req = this.verifications().find((v) => v.id === id);
    if (!req) return;
    this.verifications.update((list) => list.filter((v) => v.id !== id));
    this.partners.update((list) => [
      {
        id: 'p' + Date.now(),
        name: req.name,
        type: 'service',
        rating: 0,
        jobsDone: 0,
        earnings: 0,
        online: false,
        verified: true,
        city: 'Jaipur',
      },
      ...list,
    ]);
  }

  rejectPartner(id: string): void {
    this.verifications.update((list) => list.filter((v) => v.id !== id));
  }

  resolveDispute(id: string, resolution: DisputeStatus): void {
    this.disputes.update((list) => list.map((d) => (d.id === id ? { ...d, status: resolution } : d)));
  }

  markPayoutPaid(id: string): void {
    this.payouts.update((list) => list.map((p) => (p.id === id ? { ...p, status: 'paid' as const } : p)));
  }

  markInvoicePaid(id: string): void {
    this.invoices.update((list) => list.map((i) => (i.id === id ? { ...i, status: 'paid' as const } : i)));
  }

  advanceRepair(id: string): void {
    const order: RepairTicket['stage'][] = ['received', 'diagnosis', 'repairing', 'qc', 'delivered'];
    this.repairs.update((list) =>
      list.map((r) => {
        if (r.id !== id) return r;
        const next = order[Math.min(order.indexOf(r.stage) + 1, order.length - 1)];
        return { ...r, stage: next };
      }),
    );
  }

  startProduction(id: string): void {
    this.projects.update((list) => list.map((p) => (p.id === id ? { ...p, status: 'in-production' as const, eta: '18 Nov' } : p)));
  }
}
