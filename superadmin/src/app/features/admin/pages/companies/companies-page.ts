import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { OperationsService } from '../../../../core/services/operations.service';

@Component({
  selector: 'app-companies-page',
  imports: [],
  templateUrl: './companies-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CompaniesPage {
  readonly ops = inject(OperationsService);

  amcClass(amc: string): string {
    switch (amc) {
      case 'Active': return 'ok';
      case 'Expiring': return 'warn';
      default: return 'muted';
    }
  }
}
