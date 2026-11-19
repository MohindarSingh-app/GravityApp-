import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { OperationsService } from '../../../../core/services/operations.service';

@Component({
  selector: 'app-inventory-page',
  imports: [],
  templateUrl: './inventory-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InventoryPage {
  readonly ops = inject(OperationsService);

  stockClass(item: { stock: number; low: number }): string {
    if (item.stock <= item.low) return 'bad';
    if (item.stock <= item.low * 2) return 'warn';
    return 'ok';
  }
}
