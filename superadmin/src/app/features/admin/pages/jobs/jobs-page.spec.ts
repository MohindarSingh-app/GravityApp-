import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { AdminApiService } from '../../../../core/services/admin-api.service';
import { AuthService } from '../../../../core/services/auth.service';
import { OperationsService } from '../../../../core/services/operations.service';
import { JobsPage } from './jobs-page';

describe('JobsPage', () => {
  let fixture: ComponentFixture<JobsPage>;
  let page: JobsPage;
  let operations: OperationsService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [JobsPage],
      providers: [
        { provide: AdminApiService, useValue: { getOperations: vi.fn() } },
        { provide: AuthService, useValue: { canAccess: () => false } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(JobsPage);
    page = fixture.componentInstance;
    operations = TestBed.inject(OperationsService);
    operations.jobs.set([{
      id: 'EC-IND-0140',
      company: 'Test Company',
      service: 'VFD Repair',
      partner: null,
      status: 'unassigned',
      slaMinsLeft: 30,
      amount: 4200,
      site: 'Test Site',
      asset: 'Delta VFD',
      activity: [],
    }]);
    operations.partners.set([{
      id: 'test-partner',
      name: 'Suresh Kumar',
      type: 'service',
      rating: 0,
      jobsDone: 0,
      online: false,
      verified: true,
      city: 'Test City',
    }]);
    fixture.detectChanges();
  });

  it('renders the operational queue and open-job summaries', () => {
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelectorAll('.job-card')).toHaveLength(1);
    expect(element.querySelector('.jobs-header.directory-hero')).not.toBeNull();
    expect(element.querySelectorAll('.job-card-strip')).toHaveLength(1);
    expect(element.querySelectorAll('.job-card-body')).toHaveLength(1);
    expect(element.querySelector('.job-metrics')?.textContent).toContain('Open jobs');
    expect(element.querySelector('.job-metrics')?.textContent).toContain('Needs attention');
    expect(element.textContent).toContain('Changes are session-only');
  });

  it('filters unassigned jobs and searches detailed job fields', () => {
    page.setFilter('unassigned');
    fixture.detectChanges();

    expect(page.filteredJobs().map((job) => job.id)).toEqual(['EC-IND-0140']);
    expect(page.count('unassigned')).toBe(1);

    page.setFilter('all');
    page.setSearch({ target: { value: 'Delta VFD' } } as unknown as Event);

    expect(page.filteredJobs().map((job) => job.id)).toEqual(['EC-IND-0140']);
  });

  it('records assignment and completion in the selected job details', () => {
    const jobId = 'EC-IND-0140';
    page.openDetails(jobId);
    page.assign(jobId, { target: { value: 'Suresh Kumar' } } as unknown as Event);

    expect(page.selectedJob()?.partner).toBe('Suresh Kumar');
    expect(page.selectedJob()?.activity?.at(-1)?.title).toBe('Partner assigned');

    page.complete(jobId);

    expect(operations.jobs().find((job) => job.id === jobId)?.status).toBe('completed');
    expect(page.selectedJob()?.slaMinsLeft).toBeNull();
    expect(page.selectedJob()?.activity?.at(-1)?.title).toBe('Job completed');
  });

  it('supports session-only scheduling, delivery stages, checklists and work notes', () => {
    const jobId = 'EC-IND-0140';
    const scheduledAt = new Date(Date.now() + 60_000).toISOString();
    operations.assignJob(jobId, 'Suresh Kumar');
    let job = operations.jobs().find((entry) => entry.id === jobId)!;

    expect(operations.jobStage(job)).toBe('assigned');
    expect(operations.scheduleJob(jobId, scheduledAt)).toBe(true);
    expect(operations.jobStage(operations.jobs().find((entry) => entry.id === jobId)!))
      .toBe('scheduled');
    expect(operations.toggleJobChecklistItem(jobId, 'safety')).toBe(true);
    expect(operations.jobChecklist(operations.jobs().find((entry) => entry.id === jobId)!)
      .find((item) => item.id === 'safety')?.done).toBe(true);

    expect(operations.advanceJobStage(jobId)).toBe(true);
    expect(operations.addJobWorkNote(jobId, 'Insulation check passed.')).toBe(true);
    expect(operations.addJobWorkNote(jobId, '   ')).toBe(false);
    job = operations.jobs().find((entry) => entry.id === jobId)!;
    expect(operations.jobStage(job)).toBe('on-site');
    expect(job.workNotes?.at(-1)?.detail).toBe('Insulation check passed.');
  });
});
