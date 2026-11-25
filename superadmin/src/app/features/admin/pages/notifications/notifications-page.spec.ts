import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { AuditEntry } from '../../../../core/models/user.model';
import { NotificationService } from '../../../../core/services/notification.service';
import { NotificationsPage } from './notifications-page';

describe('NotificationsPage', () => {
  let events: AuditEntry[];
  let readIds: Set<string>;
  let unreadCount: ReturnType<typeof computed<number>>;
  let refresh: ReturnType<typeof vi.fn>;
  let markAllRead: ReturnType<typeof vi.fn>;
  let markRead: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    events = [
      {
        id: 'event-1',
        at: '2026-11-20T10:00:00.000Z',
        actorId: 'admin-1',
        actorEmail: 'admin@example.test',
        action: 'auth.login_failed',
        targetType: 'session',
        targetId: 'session-1',
        details: {},
      },
      {
        id: 'event-2',
        at: '2026-11-20T09:00:00.000Z',
        actorId: 'admin-2',
        actorEmail: 'other@example.test',
        action: 'user.created',
        targetType: 'user',
        targetId: 'user-2',
        details: {},
      },
    ];
    readIds = new Set(['event-2']);
    const eventSignal = signal(events);
    const readSignal = signal(readIds);
    unreadCount = computed(() => eventSignal().filter((event) => !readSignal().has(event.id)).length);
    refresh = vi.fn(async () => undefined);
    markAllRead = vi.fn(() => readSignal.set(new Set(eventSignal().map((event) => event.id))));
    markRead = vi.fn((id: string) => readSignal.update((ids) => new Set(ids).add(id)));

    await TestBed.configureTestingModule({
      imports: [NotificationsPage],
      providers: [{
        provide: NotificationService,
        useValue: {
          events: eventSignal,
          loading: signal(false),
          loaded: signal(true),
          error: signal(null),
          unreadCount,
          refresh,
          markAllRead,
          markRead,
          isRead: (id: string) => readSignal().has(id),
        },
      }],
    }).compileComponents();
  });

  it('shows audit-backed notifications and filters to unread entries', async () => {
    const fixture = TestBed.createComponent(NotificationsPage);
    await fixture.whenStable();
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    expect(refresh).toHaveBeenCalledWith(true);
    expect(element.querySelectorAll('.notification-item')).toHaveLength(2);
    expect(element.textContent).toContain('Failed sign-in attempt');

    const unreadFilter = Array.from(element.querySelectorAll<HTMLButtonElement>('.filter-chip'))
      .find((button) => button.textContent?.includes('Unread'))!;
    unreadFilter.click();
    fixture.detectChanges();
    expect(element.querySelectorAll('.notification-item')).toHaveLength(1);
    expect(element.querySelector('.notification-item')?.textContent).toContain('Failed sign-in attempt');
  });

  it('marks individual notifications as read', async () => {
    const fixture = TestBed.createComponent(NotificationsPage);
    await fixture.whenStable();
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    element.querySelector<HTMLButtonElement>('.mail-row-main')!.click();
    fixture.detectChanges();
    element.querySelector<HTMLButtonElement>('.mark-read-button')!.click();
    fixture.detectChanges();

    expect(markRead).toHaveBeenCalledWith('event-1');
    expect(element.textContent).toContain('0 unread');
  });

  it('searches notification senders and message content', async () => {
    const fixture = TestBed.createComponent(NotificationsPage);
    await fixture.whenStable();
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const search = element.querySelector<HTMLInputElement>('.search-box input')!;

    search.value = 'other@example.test';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();

    expect(element.querySelectorAll('.notification-item')).toHaveLength(1);
    expect(element.querySelector('.mail-sender-line')?.textContent).toContain('other@example.test');
  });
});
