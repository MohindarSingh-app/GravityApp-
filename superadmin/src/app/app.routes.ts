import { Routes } from '@angular/router';
import { authGuard, guestGuard, permissionGuard, superadminGuard } from './core/guards/auth.guards';
import { AuthLayout } from './features/auth/layout/auth-layout';
import { Login } from './features/auth/pages/login/login';
import { Register } from './features/auth/pages/register/register';
import { ForgotPassword } from './features/auth/pages/forgot-password/forgot-password';
import { AdminLayout } from './features/admin/admin-layout';

export const routes: Routes = [
  {
    path: 'session/impersonate',
    loadComponent: () => import('./features/auth/pages/impersonation-launch/impersonation-launch')
      .then((module) => module.ImpersonationLaunch),
    title: 'Opening user panel · Energy Hub Admin',
  },

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
      {
        path: 'analytics',
        loadComponent: () => import('./features/admin/pages/analytics/analytics-page')
          .then((module) => module.AnalyticsPage),
        canActivate: [permissionGuard('analytics')],
        title: 'Analytics · Energy Hub Admin',
      },
      {
        path: 'profile',
        loadComponent: () => import('./features/admin/pages/profile/profile-page')
          .then((module) => module.ProfilePage),
        title: 'My Profile · Energy Hub Admin',
      },
      {
        path: 'notifications',
        loadComponent: () => import('./features/admin/pages/notifications/notifications-page')
          .then((module) => module.NotificationsPage),
        canActivate: [superadminGuard],
        title: 'Notifications · Energy Hub Admin',
      },

      // Operations
      {
        path: 'livemonitor',
        loadComponent: () => import('./features/admin/pages/livemonitor/livemonitor-page').then((module) => module.LivemonitorPage),
        canActivate: [permissionGuard('livemonitor')],
        title: 'Live Monitor',
      },
      {
        path: 'jobs',
        loadComponent: () => import('./features/admin/pages/jobs/jobs-page').then((module) => module.JobsPage),
        canActivate: [permissionGuard('jobs')],
        title: 'Jobs',
      },
      {
        path: 'repair',
        loadComponent: () => import('./features/admin/pages/repair/repair-page').then((module) => module.RepairPage),
        canActivate: [permissionGuard('repair')],
        title: 'Repair Center',
      },
      {
        path: 'projects',
        loadComponent: () => import('./features/admin/pages/projects/projects-page').then((module) => module.ProjectsPage),
        canActivate: [permissionGuard('projects')],
        title: 'Projects',
      },
      {
        path: 'inventory',
        loadComponent: () => import('./features/admin/pages/inventory/inventory-page').then((module) => module.InventoryPage),
        canActivate: [permissionGuard('inventory')],
        title: 'Inventory',
      },

      // Field Partners
      {
        path: 'verification',
        loadComponent: () => import('./features/admin/pages/verification/verification-page').then((module) => module.VerificationPage),
        canActivate: [permissionGuard('verification')],
        title: 'Partner Verification',
      },
      {
        path: 'disputes',
        loadComponent: () => import('./features/admin/pages/disputes/disputes-page').then((module) => module.DisputesPage),
        canActivate: [permissionGuard('disputes')],
        title: 'Disputes',
      },
      {
        path: 'directory/:id',
        loadComponent: () => import('./features/admin/pages/registration-profile/registration-profile-page')
          .then((module) => module.RegistrationProfilePage),
        canActivate: [permissionGuard('directory')],
        title: 'Registration Profile',
      },
      {
        path: 'directory',
        loadComponent: () => import('./features/admin/pages/directory/directory-page').then((module) => module.DirectoryPage),
        canActivate: [permissionGuard('directory')],
        title: 'App Registrations',
      },

      // Business
      {
        path: 'companies',
        loadComponent: () => import('./features/admin/pages/companies/companies-page').then((module) => module.CompaniesPage),
        canActivate: [permissionGuard('companies')],
        title: 'Companies',
      },
      {
        path: 'amc',
        loadComponent: () => import('./features/admin/pages/amc/amc-page').then((module) => module.AmcPage),
        canActivate: [permissionGuard('amc')],
        title: 'AMC Contracts',
      },
      {
        path: 'finance',
        loadComponent: () => import('./features/admin/pages/finance/finance-page').then((module) => module.FinancePage),
        canActivate: [permissionGuard('finance')],
        title: 'Finance & Payouts',
      },
      {
        path: 'invoices',
        loadComponent: () => import('./features/admin/pages/invoices/invoices-page').then((module) => module.InvoicesPage),
        canActivate: [permissionGuard('invoices')],
        title: 'Invoices',
      },

      // Application controls
      {
        path: 'modules/customer-panel',
        loadComponent: () => import('./features/admin/pages/customer-panel/customer-panel-page')
          .then((module) => module.CustomerPanelPage),
        canActivate: [permissionGuard('customer-panel')],
        title: 'Customer Panel Control',
      },
      {
        path: 'modules/partner-app',
        loadComponent: () => import('./features/admin/pages/partner-app/partner-app-page')
          .then((module) => module.PartnerAppPage),
        canActivate: [permissionGuard('partner-app')],
        title: 'Partner App Control',
      },

      // Administration
      {
        path: 'modules/users',
        loadComponent: () => import('./features/admin/pages/users/users-page')
          .then((module) => module.UsersPage),
        canActivate: [permissionGuard('users')],
        title: 'Users & Roles',
      },
      {
        path: 'modules/activity',
        loadComponent: () => import('./features/admin/pages/activity/activity-page').then((module) => module.ActivityPage),
        canActivate: [permissionGuard('activity')],
        title: 'Activity Log',
      },
      {
        path: 'modules/settings',
        loadComponent: () => import('./features/admin/pages/settings/settings-page').then((module) => module.SettingsPage),
        canActivate: [permissionGuard('settings')],
        title: 'Settings',
      },

      { path: '**', redirectTo: 'dashboard' },
    ],
  },
];
