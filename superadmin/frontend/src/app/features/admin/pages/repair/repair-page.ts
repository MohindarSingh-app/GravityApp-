import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { OperationsService } from '../../../../core/services/operations.service';

const STAGE_LABELS: Record<string, string> = {
  received: 'Received',
  diagnosis: 'Diagnosis',
  repairing: 'Repairing',
  qc: 'QC',
  delivered: 'Delivered',
};

@Component({
  selector: 'app-repair-page',
  imports: [],
  templateUrl: './repair-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RepairPage {
  readonly ops = inject(OperationsService);

  stageLabel(stage: string): string {
    return STAGE_LABELS[stage] ?? stage;
  }

  stagePillClass(stage: string): string {
    switch (stage) {
      case 'delivered': return 'ok';
      case 'qc': return 'info';
      case 'repairing': return 'warn';
      case 'received': return 'muted';
      default: return 'info';
    }
  }
}
