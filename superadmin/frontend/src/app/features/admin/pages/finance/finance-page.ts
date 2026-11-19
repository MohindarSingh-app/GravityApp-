import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { OperationsService } from '../../../../core/services/operations.service';

@Component({
  selector: 'app-finance-page',
  imports: [],
  templateUrl: './finance-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FinancePage {
  readonly ops = inject(OperationsService);
}
