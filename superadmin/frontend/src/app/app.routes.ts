import { Routes } from '@angular/router';
import { authGuard, guestGuard, permissionGuard } from './core/guards/auth.guards';
import { AuthLayout } from './features/auth/layout/auth-layout';
import { Login } from './features/auth/pages/login/login';
import { Register } from './features/auth/pages/register/register';
import { ForgotPassword } from './features/auth/pages/forgot-password/forgot-password';
import { AdminLayout } from './features/admin/admin-layout';
import { CustomerPanelPage } from './features/admin/pages/customer-panel/customer-panel-page';
import { PartnerAppPage } from './features/admin/pages/partner-app/partner-app-page';
import { UsersPage } from './features/admin/pages/users/users-page';
import { ActivityPage } from './features/admin/pages/activity/activity-page';
import { SettingsPage } from './features/admin/pages/settings/settings-page';
import { JobsPage } from './features/admin/pages/jobs/jobs-page';
import { AnalyticsPage } from './features/admin/pages/analytics/analytics-page';
import { LivemonitorPage } from './features/admin/pages/livemonitor/livemonitor-page';
import { RepairPage } from './features/admin/pages/repair/repair-page';
import { ProjectsPage } from './features/admin/pages/projects/projects-page';
import { InventoryPage } from './features/admin/pages/inventory/inventory-page';
import { VerificationPage } from './features/admin/pages/verification/verification-page';
import { DisputesPage } from './features/admin/pages/disputes/disputes-page';
import { DirectoryPage } from './features/admin/pages/directory/directory-page';
import { CompaniesPage } from './features/admin/pages/companies/companies-page';
import { AmcPage } from './features/admin/pages/amc/amc-page';
import { FinancePage } from './features/admin/pages/finance/finance-page';
import { InvoicesPage } from './features/admin/pages/invoices/invoices-page';

export const routes: Routes = [
  // ---------- Auth (guest only) ----------
  {
    path: 'auth',
    canActivate: [guestGuard],
    component: AuthLayout,
    children: [
      { path: '', redirectTo: 'login', pathMatch: 'full' },
      { path: 'login', component: Login, title: 'Sign In · Energy Hub Admin' },
      { path: 'register', component: Register, title: 'Create Account · Energy Hub Admin' },
      { path: 'forgot-password', component: ForgotPassword, title: 'Reset Password · Energy Hub Admin' },
    ],
  },

  // ---------- Admin area (auth required) ----------
  {
    path: '',
    canActivate: [authGuard],
    component: AdminLayout,
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },

      // Overview
      {
        path: 'dashboard',
        loadComponent: () => import('./features/admin/pages/dashboard/dashboard-page').then((module) => module.DashboardPage),
        canActivate: [permissionGuard('dashboard')],
        title: 'Dashboard · Energy Hub Admin',
      },
      { path: 'analytics', component: AnalyticsPage, canActivate: [permissionGuard('analytics')], title: 'Analytics · Energy Hub Admin' },

      // Operations
      { path: 'livemonitor', component: LivemonitorPage, canActivate: [permissionGuard('livemonitor')], title: 'Live Monitor' },
      { path: 'jobs', component: JobsPage, canActivate: [permissionGuard('jobs')], title: 'Jobs' },
      { path: 'repair', component: RepairPage, canActivate: [permissionGuard('repair')], title: 'Repair Center' },
      { path: 'projects', component: ProjectsPage, canActivate: [permissionGuard('projects')], title: 'Projects' },
      { path: 'inventory', component: InventoryPage, canActivate: [permissionGuard('inventory')], title: 'Inventory' },

      // Field Partners
      { path: 'verification', component: VerificationPage, canActivate: [permissionGuard('verification')], title: 'Partner Verification' },
      { path: 'disputes', component: DisputesPage, canActivate: [permissionGuard('disputes')], title: 'Disputes' },
      { path: 'directory', component: DirectoryPage, canActivate: [permissionGuard('directory')], title: 'Partner Directory' },

      // Business
      { path: 'companies', component: CompaniesPage, canActivate: [permissionGuard('companies')], title: 'Companies' },
      { path: 'amc', component: AmcPage, canActivate: [permissionGuard('amc')], title: 'AMC Contracts' },
      { path: 'finance', component: FinancePage, canActivate: [permissionGuard('finance')], title: 'Finance & Payouts' },
      { path: 'invoices', component: InvoicesPage, canActivate: [permissionGuard('invoices')], title: 'Invoices' },

      // Application controls
      { path: 'modules/customer-panel', component: CustomerPanelPage, canActivate: [permissionGuard('customer-panel')], title: 'Customer Panel Control' },
      { path: 'modules/partner-app', component: PartnerAppPage, canActivate: [permissionGuard('partner-app')], title: 'Partner App Control' },

      // Administration
      {
        path: 'modules/users',
        component: UsersPage,
        canActivate: [permissionGuard('users')],
        title: 'Users & Roles',
      },
      { path: 'modules/activity', component: ActivityPage, canActivate: [permissionGuard('activity')], title: 'Activity Log' },
      { path: 'modules/settings', component: SettingsPage, canActivate: [permissionGuard('settings')], title: 'Settings' },

      { path: '**', redirectTo: 'dashboard' },
    ],
  },
];
