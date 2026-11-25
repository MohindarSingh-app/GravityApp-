import { computed, inject, Injectable, signal } from '@angular/core';
import { AdminApiService } from './admin-api.service';
import { AuthService } from './auth.service';
import type { AuditEntry } from '../models/user.model';

const MAX_NOTIFICATIONS = 100;

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly api = inject(AdminApiService);
  private readonly auth = inject(AuthService);
  private loadedUserId: string | null = null;
  private requestSequence = 0;
  private readonly readIds = signal<ReadonlySet<string>>(new Set());

  readonly events = signal<AuditEntry[]>([]);
  readonly loading = signal(false);
  readonly loaded = signal(false);
  readonly error = signal<string | null>(null);
  readonly unreadCount = computed(() =>
    this.events().filter((event) => !this.readIds().has(event.id)).length,
  );

  async refresh(force = false): Promise<void> {
    const user = this.auth.currentUser();
    if (!user || user.role !== 'superadmin' || this.auth.impersonation()) {
      this.reset();
      return;
    }
    if (this.loading() || (!force && this.loaded() && this.loadedUserId === user.id)) return;

    const requestSequence = ++this.requestSequence;
    this.loading.set(true);
    this.error.set(null);
    try {
      const events = await this.api.getAuditEvents();
      const currentUser = this.auth.currentUser();
      if (requestSequence !== this.requestSequence ||
        currentUser?.id !== user.id ||
        currentUser.role !== 'superadmin' ||
        this.auth.impersonation()) return;

      this.events.set(events.slice(0, MAX_NOTIFICATIONS));
      this.readIds.set(this.loadReadIds(user.id));
      this.loadedUserId = user.id;
      this.loaded.set(true);
    } catch (error) {
      if (requestSequence === this.requestSequence) {
        this.error.set(this.api.errorMessage(error, 'Unable to load notifications.'));
      }
    } finally {
      if (requestSequence === this.requestSequence) this.loading.set(false);
    }
  }

  isRead(id: string): boolean {
    return this.readIds().has(id);
  }

  markRead(id: string): void {
    if (!this.events().some((event) => event.id === id)) return;
    const updated = new Set(this.readIds());
    updated.add(id);
    this.readIds.set(updated);
    this.persistReadIds(updated);
  }

  markAllRead(): void {
    const updated = new Set(this.events().map((event) => event.id));
    this.readIds.set(updated);
    this.persistReadIds(updated);
  }

  reset(): void {
    this.requestSequence += 1;
    this.events.set([]);
    this.readIds.set(new Set());
    this.loadedUserId = null;
    this.loaded.set(false);
    this.loading.set(false);
    this.error.set(null);
  }

  private loadReadIds(userId: string): Set<string> {
    try {
      const saved = globalThis.localStorage.getItem(this.storageKey(userId));
      if (!saved) return new Set();
      const parsed: unknown = JSON.parse(saved);
      if (!Array.isArray(parsed) || parsed.some((id) => typeof id !== 'string')) {
        this.error.set('Saved notification read status is invalid. New notifications will be shown as unread.');
        return new Set();
      }
      return new Set(parsed);
    } catch {
      this.error.set('Saved notification read status could not be loaded. New notifications will be shown as unread.');
      return new Set();
    }
  }

  private persistReadIds(ids: ReadonlySet<string>): void {
    const userId = this.loadedUserId;
    if (!userId) return;
    try {
      globalThis.localStorage.setItem(this.storageKey(userId), JSON.stringify([...ids]));
    } catch {
      this.error.set('Read status could not be saved on this device.');
    }
  }

  private storageKey(userId: string): string {
    return `gravityhub.notifications.read.${encodeURIComponent(userId)}`;
  }
}
