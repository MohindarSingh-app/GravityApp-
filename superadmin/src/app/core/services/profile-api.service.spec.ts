import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { TAB_SESSION_KEY, tabSessionInterceptor } from '../http/tab-session.interceptor';
import { ProfileApiService } from './profile-api.service';

describe('ProfileApiService', () => {
  let http: HttpTestingController;
  let service: ProfileApiService;
  const originalCreateObjectUrl = URL.createObjectURL;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([tabSessionInterceptor])),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(ProfileApiService);
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:authenticated-profile-photo'),
    });
  });

  afterEach(() => {
    http.verify();
    sessionStorage.removeItem(TAB_SESSION_KEY);
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: originalCreateObjectUrl,
    });
  });

  it('fetches private avatar bytes through the authenticated HTTP client', async () => {
    sessionStorage.setItem(TAB_SESSION_KEY, 'tab-session-token');
    const loading = service.loadAvatar('/api/superadmin/console/auth/profile/avatar?v=1');
    const request = http.expectOne('/api/superadmin/console/auth/profile/avatar?v=1');

    expect(request.request.method).toBe('GET');
    expect(request.request.responseType).toBe('blob');
    expect(request.request.headers.get('Authorization')).toBe('Bearer tab-session-token');
    request.flush(new Blob(['profile image'], { type: 'image/png' }));
    await loading;

    expect(service.avatarImageUrl()).toBe('blob:authenticated-profile-photo');
    expect(service.avatarLoadError()).toBeNull();
  });
});
