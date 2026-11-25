import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { OperationsService } from '../../../../core/services/operations.service';

interface PartnerRole {
  id: string;
  title: string;
  desc: string;
}

const ROLE_DEFINITIONS: PartnerRole[] = [
  { id: 'service', title: 'Service Partner', desc: 'Onsite jobs, workflow, schedule, earnings' },
  { id: 'repairing', title: 'Repairing Partner', desc: 'New jobs queue + workshop repair flow' },
  { id: 'panelmaker', title: 'Panel Maker', desc: 'New requests + production queue' },
  { id: 'supplier', title: 'Supplier', desc: 'Catalog, product form, deliveries' },
];

const FLOWS = [
  { id: 'onboard', title: 'Onboarding Flow', steps: 'mobile → OTP → personal → professional → documents → area → review → status' },
  { id: 'job', title: 'Job Lifecycle', steps: 'incoming → accepted → detail → calling → workflow → success' },
  { id: 'delivery', title: 'Delivery Jobs', steps: 'delivery-job → delivery-success' },
  { id: 'misc', title: 'Misc Screens', steps: 'schedule, earnings, profile, specializations' },
];

@Component({
  selector: 'app-partner-app-page',
  imports: [],
  templateUrl: './partner-app-page.html',
  styleUrl: './partner-app-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PartnerAppPage {
  readonly operations = inject(OperationsService);
  readonly roles = computed(() => ROLE_DEFINITIONS.map((role) => ({
    ...role,
    partners: this.operations.partnerRoleCounts()
      .find((partnerRole) => partnerRole.type === role.id)?.count ?? 0,
  })));
  readonly flows = FLOWS;
  readonly totalPartners = computed(() =>
    this.operations.partnerRoleCounts().reduce((total, role) => total + role.count, 0),
  );
}
