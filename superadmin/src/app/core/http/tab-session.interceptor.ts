import { HttpInterceptorFn } from '@angular/common/http';

export const TAB_SESSION_KEY = 'eh_impersonation_session';
export const TAB_INSTANCE_KEY = 'eh_tab_instance';
const API_PREFIX = '/api/superadmin/console/';
const EXCHANGE_PATH = '/api/superadmin/console/auth/impersonation/exchange';

export const tabSessionInterceptor: HttpInterceptorFn = (request, next) => {
  if (typeof sessionStorage === 'undefined' || request.url.includes(EXCHANGE_PATH) ||
      !request.url.startsWith(API_PREFIX)) {
    return next(request);
  }
  const token = sessionStorage.getItem(TAB_SESSION_KEY);
  return token
    ? next(request.clone({ setHeaders: { Authorization: `Bearer ${token}` } }))
    : next(request);
};
