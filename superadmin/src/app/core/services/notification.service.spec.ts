import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AdminApiService } from './admin-api.service';
import { AuthService } from './auth.service';
import { NotificationService } from './notification.service';
import type { AuditEntry } from '../models/user.model';

describe('NotificationService', () => {
  const userId = 'notification-test-superadmin';
  const storageKey = `gravityhub.notifications.read.${encodeURIComponent(userId)}`;
  let currentUser: ReturnType<typeof signal<{ id: string; role: string } | null>>;
  let events: AuditEntry[];
  let getAuditEvents: ReturnType<typeof vi.fn>;
  let service: NotificationService;

  beforeEach(() => {
    globalThis.localStorage.removeItem(storageKey);
    currentUser = signal({ id: userId, role: 'superadmin' });
    events = [
      {
        id: 'notice-1',
        at: '2026-11-20T10:00:00.000Z',
        actorId: 'admin-1',
        actorEmail: 'admin@example.test',
        action: 'user.created',
        targetType: 'user',
        targetId: 'admin-2',
        details: {},
      },
      {
        id: 'notice-2',
        at: '2026-11-20T09:00:00.000Z',
        actorId: 'admin-1',
        actorEmail: 'admin@example.test',
        action: 'auth.login_failed',
        targetType: 'session',
        targetId: 'session-1',
        details: {},
      },
    ];
    getAuditEvents = vi.fn(async () => events);

    TestBed.configureTestingModule({
      providers: [
        {
          provide: AdminApiService,
          useValue: {
            getAuditEvents,
            errorMessage: (_error: unknown, fallback: string) => fallback,
          },
        },
        {
          provide: AuthService,
          useValue: {
            currentUser,
            impersonation: signal(null),
          },
        },
      ],
    });
    service = TestBed.inject(NotificationService);
  });

  afterEach(() => {
    globalThis.localStorage.removeItem(storageKey);
  });

  it('loads audit events, tracks unread state, and persists read status', async () => {
    await service.refresh();
    expect(service.unreadCount()).toBe(2);

    service.markRead('notice-1');
    expect(service.unreadCount()).toBe(1);

    service.reset();
    await service.refresh();
    expect(service.isRead('notice-1')).toBe(true);
    expect(service.unreadCount()).toBe(1);

    service.markAllRead();
    expect(service.unreadCount()).toBe(0);
  });

  it('does not request audit events for non-Super Admin accounts', async () => {
    currentUser.set({ id: userId, role: 'admin' });
    await service.refresh();

    expect(getAuditEvents).not.toHaveBeenCalled();
    expect(service.events()).toEqual([]);
  });
});
