import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ThemeService } from '../../core/services/theme.service';
import { ProfileApiService } from '../../core/services/profile-api.service';
import { NotificationService } from '../../core/services/notification.service';
import type { PageKey } from '../../core/models/user.model';
import { AdminProfileSetupDialog } from './admin-profile-setup-dialog';
import { OperationsService } from '../../core/services/operations.service';

interface NavItem {
  label: string;
  icon: string;
  route: string;
  page?: PageKey;
  superadminOnly?: boolean;
  exact?: boolean;
  badge?: string;
  badgeTone?: 'green' | 'red' | 'yellow' | 'blue';
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

@Component({
  selector: 'app-admin-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, NgTemplateOutlet, AdminProfileSetupDialog],
  templateUrl: './admin-layout.html',
  styleUrl: './admin-layout.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminLayout {
  private auth = inject(AuthService);
  private router = inject(Router);
  readonly theme = inject(ThemeService);
  private readonly profileApi = inject(ProfileApiService);
  readonly operations = inject(OperationsService);
  readonly notifications = inject(NotificationService);

  readonly user = this.auth.currentUser;
  readonly avatarImageUrl = this.profileApi.avatarImageUrl;
  readonly impersonation = this.auth.impersonation;
  readonly sidebarOpen = signal(typeof window === 'undefined' || window.innerWidth > 900);
  readonly logoutError = signal<string | null>(null);
  readonly expandedNavGroup = signal<string | null>(null);

  readonly nav: NavGroup[] = [
    {
      label: 'Overview',
      items: [
        { label: 'Dashboard', icon: 'grid', route: '/dashboard', page: 'dashboard', exact: true },
        { label: 'Analytics', icon: 'chart', route: '/analytics', page: 'analytics' },
      ],
    },
    {
      label: 'Operations',
      items: [
        { label: 'Live Monitor', icon: 'pulse', route: '/livemonitor', page: 'livemonitor', badge: 'LIVE', badgeTone: 'green' },
        { label: 'Jobs', icon: 'list', route: '/jobs', page: 'jobs' },
        { label: 'Repair Center', icon: 'tool', route: '/repair', page: 'repair' },
        { label: 'Projects', icon: 'box', route: '/projects', page: 'projects' },
        { label: 'Inventory', icon: 'box', route: '/inventory', page: 'inventory' },
      ],
    },
    {
      label: 'Field Partners',
      items: [
        { label: 'Verification', icon: 'check', route: '/verification', page: 'verification' },
        { label: 'Disputes', icon: 'warn', route: '/disputes', page: 'disputes' },
        { label: 'App Registrations', icon: 'users', route: '/directory', page: 'directory' },
      ],
    },
    {
      label: 'Business',
      items: [
        { label: 'Companies', icon: 'building', route: '/companies', page: 'companies' },
        { label: 'AMC Contracts', icon: 'list', route: '/amc', page: 'amc' },
        { label: 'Finance & Payouts', icon: 'rupee', route: '/finance', page: 'finance' },
        { label: 'Invoices', icon: 'doc', route: '/invoices', page: 'invoices' },
      ],
    },
    {
      label: 'Apps & Admin',
      items: [
        { label: 'Customer Panel', icon: 'users', route: '/modules/customer-panel', page: 'customer-panel' },
        { label: 'Partner App', icon: 'truck', route: '/modules/partner-app', page: 'partner-app' },
        { label: 'Users & Roles', icon: 'shield', route: '/modules/users', page: 'users' },
        { label: 'Notifications', icon: 'bell', route: '/notifications', superadminOnly: true },
        { label: 'Activity Log', icon: 'pulse', route: '/modules/activity', page: 'activity' },
        { label: 'Settings', icon: 'gear', route: '/modules/settings', page: 'settings' },
      ],
    },
  ];

  constructor() {
    this.operations.loadAuthorizedData();
    this.updateActiveNavGroup();
    effect(() => {
      void this.profileApi.loadAvatar(this.user()?.avatarUrl ?? null);
      const user = this.user();
      const isSuperadmin = user?.role === 'superadmin' && !this.impersonation();
      untracked(() => {
        if (isSuperadmin) void this.notifications.refresh();
        else this.notifications.reset();
      });
    });
  }

  readonly visibleNav = computed(() =>
    this.nav
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => item.superadminOnly
          ? this.user()?.role === 'superadmin' && !this.impersonation()
          : !item.page || this.auth.canAccess(item.page)),
      }))
      .filter((group) => group.items.length > 0),
  );
  readonly initials = computed(() => this.user()?.avatarInitials ?? 'SA');
  readonly firstName = computed(() => {
    const name = this.user()?.name.trim();
    return name ? name.split(/\s+/)[0] : 'Superadmin';
  });

  onRouteActivated(): void {
    this.updateActiveNavGroup();
  }

  toggleSidebar(): void {
    this.sidebarOpen.update((v) => !v);
  }

  toggleNavGroup(label: string, event: MouseEvent): void {
    event.preventDefault();
    this.expandedNavGroup.update((current) => current === label ? null : label);
  }

  closeSidebarOnMobile(): void {
    if (typeof window !== 'undefined' && window.innerWidth <= 900) {
      this.sidebarOpen.set(false);
    }
  }

  toggleMode(): void {
    this.theme.toggleMode();
  }

  async logout(): Promise<void> {
    this.logoutError.set(null);
    try {
      if (this.impersonation()) {
        await this.auth.endImpersonation();
        await this.router.navigateByUrl('/modules/users');
        return;
      }
      await this.auth.logout();
      await this.router.navigate(['/auth/login']);
    } catch {
      this.logoutError.set('Unable to sign out. Check the API connection and try again.');
    }
  }

  private updateActiveNavGroup(): void {
    const route = this.router.url.split(/[?#]/, 1)[0] || '/';
    const group = this.nav.find(({ items }) =>
      items.some((item) => route === item.route || route.startsWith(`${item.route}/`)),
    );
    this.expandedNavGroup.set(group?.label ?? null);
  }
}
