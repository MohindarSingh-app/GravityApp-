import { TestBed } from '@angular/core/testing';
import { OperationsService } from '../../../../core/services/operations.service';
import { AnalyticsPage } from './analytics-page';

describe('AnalyticsPage', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AnalyticsPage],
      providers: [{
        provide: OperationsService,
        useValue: {
          sourceStatus: () => 'connected',
          analyticsRecords: () => [{
            at: new Date(Date.now() - 60_000).toISOString(),
            amount: 0,
            category: 'repair',
          }],
        },
      }],
    }).compileComponents();
  });

  it('only shows custom date inputs after selecting the custom range', () => {
    const fixture = TestBed.createComponent(AnalyticsPage);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const range = element.querySelector<HTMLSelectElement>('select[aria-label="Time range"]');

    expect(range).not.toBeNull();
    expect(range!.value).toBe('30d');
    expect(element.querySelectorAll('input[type="date"]')).toHaveLength(0);

    range!.value = 'custom';
    range!.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(element.querySelectorAll('input[type="date"]')).toHaveLength(2);

    range!.value = '24h';
    range!.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(element.querySelectorAll('input[type="date"]')).toHaveLength(0);
  });

  it('shows activity counts in category options and filters the category report', () => {
    const fixture = TestBed.createComponent(AnalyticsPage);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const category = element.querySelector<HTMLSelectElement>('.filter-field select:not([aria-label="Time range"])');

    expect(category).not.toBeNull();
    expect(Array.from(category!.options).every((option) => /· \d+$/.test(option.textContent ?? ''))).toBe(true);

    category!.value = 'repair';
    category!.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    const rows = element.querySelectorAll('.analytics-table tbody tr');
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toContain('Repair');
  });
});
