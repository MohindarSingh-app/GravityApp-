import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { OperationsService } from '../../../../core/services/operations.service';

@Component({
  selector: 'app-amc-page',
  imports: [],
  templateUrl: './amc-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AmcPage {
  readonly ops = inject(OperationsService);

  daysClass(days: number): string {
    if (days <= 30) return 'bad';
    if (days <= 90) return 'warn';
    return 'ok';
  }
}
