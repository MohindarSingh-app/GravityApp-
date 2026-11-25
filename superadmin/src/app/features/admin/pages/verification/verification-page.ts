import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { OperationsService } from '../../../../core/services/operations.service';

@Component({
  selector: 'app-verification-page',
  imports: [],
  templateUrl: './verification-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VerificationPage {
  readonly ops = inject(OperationsService);
}
