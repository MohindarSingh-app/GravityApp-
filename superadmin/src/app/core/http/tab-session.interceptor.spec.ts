import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { TAB_SESSION_KEY, tabSessionInterceptor } from './tab-session.interceptor';

describe('tabSessionInterceptor', () => {
  let http: HttpClient;
  let controller: HttpTestingController;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([tabSessionInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    controller.verify();
    sessionStorage.clear();
  });

  it('attaches only this tab’s bearer session to console API requests', () => {
    sessionStorage.setItem(TAB_SESSION_KEY, 'tab-token');
    http.get('/api/superadmin/console/auth/me').subscribe();

    const request = controller.expectOne('/api/superadmin/console/auth/me');
    expect(request.request.headers.get('Authorization')).toBe('Bearer tab-token');
    request.flush({ user: null, expiresAt: null });
  });

  it('does not send an existing tab token to the one-time exchange endpoint', () => {
    sessionStorage.setItem(TAB_SESSION_KEY, 'old-tab-token');
    http.post('/api/superadmin/console/auth/impersonation/exchange', { token: 'launch-token' })
      .subscribe();

    const request = controller.expectOne('/api/superadmin/console/auth/impersonation/exchange');
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({});
  });
});
