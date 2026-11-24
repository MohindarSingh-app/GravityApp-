import { ChangeDetectionStrategy, Component } from '@angular/core';

interface ModuleSection {
  id: string;
  title: string;
  desc: string;
}

const SECTIONS: ModuleSection[] = [
  { id: 'auth', title: 'Registration & OTP', desc: 'Customer authentication and company setup' },
  { id: 'dashboard', title: 'Customer Dashboard', desc: 'Home, service shortcuts and account summary' },
  { id: 'emergency', title: 'Emergency Service', desc: 'Emergency service request flow' },
  { id: 'booking', title: 'Service Booking', desc: 'Service category selection and request submission' },
  { id: 'jobs', title: 'My Jobs & Tracking', desc: 'Customer job list and service tracking' },
  { id: 'amc', title: 'AMC & Compliance', desc: 'Contract and compliance views' },
  { id: 'marketplace', title: 'Marketplace', desc: 'Catalog, cart, checkout and orders' },
  { id: 'support', title: 'Support', desc: 'Support requests and contact options' },
  { id: 'profile', title: 'Customer Profile', desc: 'Customer profile and site management' },
];

@Component({
  selector: 'app-customer-panel-page',
  imports: [],
  templateUrl: './customer-panel-page.html',
  styleUrl: './customer-panel-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerPanelPage {
  readonly sections = SECTIONS;
}
