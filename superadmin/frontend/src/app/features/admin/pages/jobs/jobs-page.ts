import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { OperationsService } from '../../../../core/services/operations.service';

type JobFilter = 'all' | 'unassigned' | 'progress' | 'completed' | 'sla-risk';

@Component({
  selector: 'app-jobs-page',
  imports: [],
  templateUrl: './jobs-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JobsPage {
  readonly ops = inject(OperationsService);
  activeFilter: JobFilter = 'all';

  setFilter(f: JobFilter): void {
    this.activeFilter = f;
  }

  filtered() {
    const all = this.ops.jobs();
    if (this.activeFilter === 'all') return all;
    return all.filter((j) => j.status === this.activeFilter);
  }

  count(f: JobFilter): number {
    const all = this.ops.jobs();
    return f === 'all' ? all.length : all.filter((j) => j.status === f).length;
  }

  partnerOptions() {
    return this.ops.partners().filter((p) => p.type !== 'supplier');
  }

  assign(jobId: string, event: Event): void {
    const select = event.target as HTMLSelectElement;
    if (select.value) this.ops.assignJob(jobId, select.value);
  }

  complete(jobId: string): void {
    this.ops.completeJob(jobId);
  }
}
