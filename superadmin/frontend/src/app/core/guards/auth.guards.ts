import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import type { PageKey, PermissionAction } from '../models/user.model';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.restoreSession();
  return auth.isAuthenticated() || router.createUrlTree(['/auth/login']);
};

export const guestGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.restoreSession();
  return !auth.isAuthenticated() || router.createUrlTree([auth.firstAccessibleRoute()]);
};

export const permissionGuard = (
  page: PageKey,
  action: PermissionAction = 'view',
): CanActivateFn => async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.restoreSession();
  await auth.refreshSession();
  if (!auth.isAuthenticated()) return router.createUrlTree(['/auth/login']);
  if (auth.canAccess(page, action)) return true;
  return router.createUrlTree([auth.firstAccessibleRoute()]);
};
