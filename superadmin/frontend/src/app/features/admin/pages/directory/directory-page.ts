import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { OperationsService } from '../../../../core/services/operations.service';

type DirFilter = 'all' | 'online' | 'top';

@Component({
  selector: 'app-directory-page',
  imports: [],
  templateUrl: './directory-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DirectoryPage {
  readonly ops = inject(OperationsService);
  activeFilter: DirFilter = 'all';

  readonly onlineCount = computed(() => this.ops.partners().filter((p) => p.online).length);
  readonly topCount = computed(() => this.ops.partners().filter((p) => p.rating >= 4.7).length);

  setFilter(f: DirFilter): void {
    this.activeFilter = f;
  }

  filtered() {
    const all = this.ops.partners();
    if (this.activeFilter === 'online') return all.filter((p) => p.online);
    if (this.activeFilter === 'top') return all.filter((p) => p.rating >= 4.7);
    return all;
  }

  count(f: DirFilter): number {
    const all = this.ops.partners();
    if (f === 'online') return this.onlineCount();
    if (f === 'top') return this.topCount();
    return all.length;
  }

  typeClass(type: string): string {
    switch (type) {
      case 'service': return 'b-g';
      case 'repairing': return 'b-r';
      case 'panelmaker': return 'b-b';
      default: return 'b-y';
    }
  }
}
