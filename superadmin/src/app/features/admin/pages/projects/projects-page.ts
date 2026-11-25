import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { OperationsService } from '../../../../core/services/operations.service';

@Component({
  selector: 'app-projects-page',
  imports: [],
  templateUrl: './projects-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectsPage {
  readonly ops = inject(OperationsService);

  statusClass(status: string): string {
    switch (status) {
      case 'delivered': return 'ok';
      case 'in-production': return 'info';
      default: return 'warn';
    }
  }
}
