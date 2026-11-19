import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { OperationsService, InvoiceType } from '../../../../core/services/operations.service';

@Component({
  selector: 'app-invoices-page',
  imports: [],
  templateUrl: './invoices-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InvoicesPage {
  readonly ops = inject(OperationsService);
  activeFilter: 'all' | InvoiceType = 'all';

  setFilter(f: typeof this.activeFilter): void {
    this.activeFilter = f;
  }

  filtered() {
    const all = this.ops.invoices();
    if (this.activeFilter === 'all') return all;
    return all.filter((i) => i.type === this.activeFilter);
  }

  count(f: 'all' | InvoiceType): number {
    const all = this.ops.invoices();
    return f === 'all' ? all.length : all.filter((i) => i.type === f).length;
  }

  statusClass(status: string): string {
    switch (status) {
      case 'paid': return 'ok';
      case 'overdue': return 'bad';
      default: return 'warn';
    }
  }
}
