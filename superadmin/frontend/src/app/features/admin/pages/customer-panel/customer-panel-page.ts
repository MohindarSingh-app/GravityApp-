import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';

interface ModuleSection {
  id: string;
  title: string;
  desc: string;
  status: 'live' | 'disabled';
}

/** Sections mapped from rk/zypli-customer-panel-MARKETPLACE.html */
const SECTIONS: ModuleSection[] = [
  { id: 'auth', title: 'Registration & OTP', desc: 'reg-phone, reg-otp, reg-company, reg-profile, reg-sites', status: 'live' },
  { id: 'dashboard', title: 'Customer Dashboard', desc: 'Home, quick services, hero banners', status: 'live' },
  { id: 'emergency', title: 'Emergency Service', desc: 'bk-emergency — technician in 30 min', status: 'live' },
  { id: 'booking', title: 'Service Booking', desc: 'bk-cat, bk-plc-*, bk-scada-*, bk-sub-* flows', status: 'live' },
  { id: 'jobs', title: 'My Jobs & Tracking', desc: 'jobs, track, qs-tracking, qs-electrician, qs-plc, qs-vfd', status: 'live' },
  { id: 'amc', title: 'AMC & Compliance', desc: 'amc, amc-detail, amc-new, amc-reschedule, compliance', status: 'live' },
  { id: 'marketplace', title: 'Marketplace', desc: 'marketplace-home, cart, checkout, my-orders', status: 'live' },
  { id: 'support', title: 'Support & AI Chat', desc: 'support, ai-chat, support-call, support-callback', status: 'live' },
  { id: 'profile', title: 'Customer Profile', desc: 'customer-profile, add-site, new-work flows', status: 'live' },
];

@Component({
  selector: 'app-customer-panel-page',
  imports: [],
  templateUrl: './customer-panel-page.html',
  styleUrl: './customer-panel-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerPanelPage {
  readonly sections = signal(SECTIONS);
  readonly toggles = signal<Record<string, boolean>>(
    Object.fromEntries(SECTIONS.map((s) => [s.id, s.status === 'live'])),
  );

  readonly liveCount = computed(
    () => SECTIONS.filter((s) => this.toggles()[s.id]).length,
  );

  toggle(id: string): void {
    this.toggles.update((t) => ({ ...t, [id]: !t[id] }));
  }
}
