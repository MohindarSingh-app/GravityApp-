import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import type { AuditEntry } from '../../../../core/models/user.model';
import { NotificationService } from '../../../../core/services/notification.service';

type NotificationFilter = 'all' | 'unread' | 'security' | 'access';

@Component({
  selector: 'app-notifications-page',
  templateUrl: './notifications-page.html',
  styleUrl: './notifications-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationsPage {
  readonly notifications = inject(NotificationService);
  readonly filter = signal<NotificationFilter>('all');
  readonly query = signal('');
  readonly selectedEventId = signal<string | null>(null);
  readonly filters: NotificationFilter[] = ['all', 'unread', 'security', 'access'];
  readonly visibleEvents = computed(() => {
    const events = this.notifications.events();
    const filter = this.filter();
    const query = this.query().trim().toLowerCase();
    return events.filter((event) => {
      const matchesFilter = filter === 'all' ||
        (filter === 'unread' && !this.notifications.isRead(event.id)) ||
        (filter === 'security' && event.action.startsWith('auth.')) ||
        (filter === 'access' &&
          (event.action.startsWith('user.') || event.action.startsWith('permissions.')));
      if (!matchesFilter || !query) return matchesFilter;
      const searchable = [
        this.eventTitle(event.action),
        event.actorEmail ?? '',
        event.targetType,
        event.targetId,
        this.eventDetails(event.details),
      ].join(' ').toLowerCase();
      return searchable.includes(query);
    });
  });
  readonly selectedEvent = computed(() =>
    this.notifications.events().find((event) => event.id === this.selectedEventId()) ?? null,
  );
  readonly unreadCount = computed(() => this.notifications.unreadCount());

  constructor() {
    void this.notifications.refresh(true);
  }

  setFilter(filter: NotificationFilter): void {
    this.filter.set(filter);
    this.selectedEventId.set(null);
  }

  setQuery(event: Event): void {
    const input = event.target instanceof HTMLInputElement ? event.target : null;
    this.query.set(input?.value ?? '');
  }

  openEvent(event: AuditEntry): void {
    this.selectedEventId.update((id) => id === event.id ? null : event.id);
  }

  markRead(event: AuditEntry): void {
    this.notifications.markRead(event.id);
  }

  filterLabel(filter: NotificationFilter): string {
    const labels: Record<NotificationFilter, string> = {
      all: 'Inbox',
      unread: 'Unread',
      security: 'Security',
      access: 'Access management',
    };
    return labels[filter];
  }

  filterCount(filter: NotificationFilter): number {
    if (filter === 'all') return this.notifications.events().length;
    if (filter === 'unread') return this.notifications.unreadCount();
    if (filter === 'security') {
      return this.notifications.events().filter((event) => event.action.startsWith('auth.')).length;
    }
    return this.notifications.events().filter((event) =>
      event.action.startsWith('user.') || event.action.startsWith('permissions.'),
    ).length;
  }

  senderLabel(event: AuditEntry): string {
    return event.actorEmail || 'Gravity Hub system';
  }

  senderInitials(event: AuditEntry): string {
    return (event.actorEmail?.[0] ?? 'G').toUpperCase();
  }

  eventPreview(event: AuditEntry): string {
    return this.eventDetails(event.details) ||
      (event.targetType ? `${event.targetType} · ${event.targetId}` : 'Open to view this recorded system event.');
  }

  eventTitle(action: string): string {
    const knownTitles: Record<string, string> = {
      'auth.login_succeeded': 'Successful sign-in',
      'auth.login_failed': 'Failed sign-in attempt',
      'auth.logout': 'Signed out',
      'user.created': 'Admin account created',
      'user.deleted': 'Admin account deleted',
      'user.updated': 'Admin account updated',
      'user.permissions_updated': 'User permissions updated',
      'permissions.updated': 'Role permissions updated',
    };
    return knownTitles[action] ?? action
      .replaceAll('.', ' ')
      .replaceAll('_', ' ')
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  eventCategory(action: string): string {
    if (action.startsWith('auth.')) return 'Security';
    if (action.startsWith('user.') || action.startsWith('permissions.')) return 'Access management';
    return 'System activity';
  }

  eventDetails(details: AuditEntry['details']): string {
    return Object.entries(details)
      .map(([key, value]) => `${key}: ${String(value)}`)
      .join(' · ');
  }

  formatDate(value: string): string {
    const timestamp = Date.parse(value);
    return Number.isNaN(timestamp)
      ? 'Time unavailable'
      : new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(timestamp);
  }
}
