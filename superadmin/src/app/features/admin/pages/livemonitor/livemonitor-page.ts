import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { OperationsService } from '../../../../core/services/operations.service';

@Component({
  selector: 'app-livemonitor-page',
  imports: [],
  templateUrl: './livemonitor-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LivemonitorPage {
  readonly ops = inject(OperationsService);
}
