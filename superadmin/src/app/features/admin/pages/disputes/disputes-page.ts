import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { OperationsService, DisputeStatus } from '../../../../core/services/operations.service';

@Component({
  selector: 'app-disputes-page',
  imports: [],
  templateUrl: './disputes-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DisputesPage {
  readonly ops = inject(OperationsService);
  activeFilter: 'all' | DisputeStatus = 'all';

  setFilter(f: typeof this.activeFilter): void {
    this.activeFilter = f;
  }

  filtered() {
    const all = this.ops.disputes();
    if (this.activeFilter === 'all') return all;
    return all.filter((d) => d.status === this.activeFilter);
  }

  count(f: 'all' | DisputeStatus): number {
    const all = this.ops.disputes();
    return f === 'all' ? all.length : all.filter((d) => d.status === f).length;
  }

  statusClass(status: DisputeStatus): string {
    switch (status) {
      case 'resolved': return 'ok';
      case 'investigating': return 'warn';
      default: return 'bad';
    }
  }
}
