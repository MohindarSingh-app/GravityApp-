import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ThemeService } from '../../core/services/theme.service';
import type { PageKey } from '../../core/models/user.model';

interface NavItem {
  label: string;
  icon: string;
  route: string;
  page: PageKey;
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
  imports: [RouterOutlet, RouterLink, RouterLinkActive, NgTemplateOutlet],
  templateUrl: './admin-layout.html',
  styleUrl: './admin-layout.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminLayout {
  private auth = inject(AuthService);
  private router = inject(Router);
  readonly theme = inject(ThemeService);

  readonly user = this.auth.currentUser;
  readonly sidebarOpen = signal(typeof window === 'undefined' || window.innerWidth > 900);
  readonly logoutError = signal<string | null>(null);

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
        { label: 'Jobs', icon: 'list', route: '/jobs', page: 'jobs', badge: '12', badgeTone: 'red' },
        { label: 'Repair Center', icon: 'tool', route: '/repair', page: 'repair', badge: '4', badgeTone: 'red' },
        { label: 'Projects', icon: 'box', route: '/projects', page: 'projects', badge: '3', badgeTone: 'blue' },
        { label: 'Inventory', icon: 'box', route: '/inventory', page: 'inventory' },
      ],
    },
    {
      label: 'Field Partners',
      items: [
        { label: 'Verification', icon: 'check', route: '/verification', page: 'verification', badge: '3', badgeTone: 'red' },
        { label: 'Disputes', icon: 'warn', route: '/disputes', page: 'disputes', badge: '2', badgeTone: 'yellow' },
        { label: 'Partner Directory', icon: 'users', route: '/directory', page: 'directory' },
      ],
    },
    {
      label: 'Business',
      items: [
        { label: 'Companies', icon: 'building', route: '/companies', page: 'companies' },
        { label: 'AMC Contracts', icon: 'list', route: '/amc', page: 'amc', badge: '1', badgeTone: 'yellow' },
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
        { label: 'Activity Log', icon: 'pulse', route: '/modules/activity', page: 'activity' },
        { label: 'Settings', icon: 'gear', route: '/modules/settings', page: 'settings' },
      ],
    },
  ];

  readonly visibleNav = computed(() =>
    this.nav
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => this.auth.canAccess(item.page)),
      }))
      .filter((group) => group.items.length > 0),
  );
  readonly initials = computed(() => this.user()?.avatarInitials ?? 'SA');

  toggleSidebar(): void {
    this.sidebarOpen.update((v) => !v);
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
      await this.auth.logout();
      await this.router.navigate(['/auth/login']);
    } catch {
      this.logoutError.set('Unable to sign out. Check the API connection and try again.');
    }
  }
}
