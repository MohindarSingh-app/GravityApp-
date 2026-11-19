import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';

interface PartnerRole {
  id: string;
  title: string;
  desc: string;
  partners: number;
}

/** Roles & flows mapped from rk/zypli-partner-app-MARKETPLACE (1).html */
const ROLES: PartnerRole[] = [
  { id: 'service', title: 'Service Partner', desc: 'Onsite jobs, workflow, schedule, earnings', partners: 148 },
  { id: 'repairing', title: 'Repairing Partner', desc: 'New jobs queue + workshop repair flow', partners: 62 },
  { id: 'panelmaker', title: 'Panel Maker', desc: 'New requests + production queue', partners: 40 },
  { id: 'supplier', title: 'Supplier', desc: 'Catalog, product form, deliveries', partners: 62 },
];

const FLOWS = [
  { id: 'onboard', title: 'Onboarding Flow', steps: 'mobile → OTP → personal → professional → documents → area → review → status', status: 'live' },
  { id: 'job', title: 'Job Lifecycle', steps: 'incoming → accepted → detail → calling → workflow → success', status: 'live' },
  { id: 'delivery', title: 'Delivery Jobs', steps: 'delivery-job → delivery-success', status: 'live' },
  { id: 'misc', title: 'Misc Screens', steps: 'schedule, earnings, profile, specializations', status: 'live' },
];

@Component({
  selector: 'app-partner-app-page',
  imports: [],
  templateUrl: './partner-app-page.html',
  styleUrl: './partner-app-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PartnerAppPage {
  readonly roles = signal(ROLES);
  readonly flows = signal(FLOWS);
  readonly totalPartners = computed(() => this.roles().reduce((n, r) => n + r.partners, 0));

  readonly toggles = signal<Record<string, boolean>>(
    Object.fromEntries(FLOWS.map((f) => [f.id, true])),
  );

  toggle(id: string): void {
    this.toggles.update((t) => ({ ...t, [id]: !t[id] }));
  }
}
