import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AdminApiService } from '../../../../core/services/admin-api.service';
import { AuthService } from '../../../../core/services/auth.service';
import { ProfileApiService } from '../../../../core/services/profile-api.service';
import { ThemeService } from '../../../../core/services/theme.service';
import {
  PAGE_KEYS,
  type AuditEntry,
  type CompanyProfile,
  type RolePermissions,
  type User,
} from '../../../../core/models/user.model';
import { ProfilePage } from './profile-page';

const permissions = Object.fromEntries(
  PAGE_KEYS.map((key) => [key, { view: true, create: true, edit: true, delete: true }]),
) as RolePermissions;

describe('ProfilePage', () => {
  let auditEvents: AuditEntry[];
  let getAuditEvents: ReturnType<typeof vi.fn>;
  let canAccessActivity = signal(true);
  let currentUser: ReturnType<typeof signal<User | null>>;
  let updateProfile: ReturnType<typeof vi.fn>;
  let updateCompanyProfile: ReturnType<typeof vi.fn>;
  let changePassword: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    auditEvents = [
      {
        id: 'event-1',
        at: '2026-11-20T10:00:00.000Z',
        actorId: 'admin-1',
        actorEmail: 'admin@example.test',
        action: 'auth.login_succeeded',
        targetType: 'session',
        targetId: 'session-1',
        details: {},
      },
      {
        id: 'event-2',
        at: '2026-11-20T09:00:00.000Z',
        actorId: 'admin-2',
        actorEmail: 'other@example.test',
        action: 'user.updated',
        targetType: 'user',
        targetId: 'admin-3',
        details: {},
      },
    ];
    canAccessActivity = signal(true);
    getAuditEvents = vi.fn(async () => auditEvents);
    const user: User = {
      id: 'admin-1',
      userCode: '123-AB_',
      name: 'Ada Admin',
      email: 'admin@example.test',
      phone: null,
      role: 'superadmin',
      avatarInitials: 'AA',
      avatarUrl: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      accessMode: 'custom',
      permissionsAssignedBy: { name: 'Root Admin', email: 'root@example.test' },
      permissions,
    };
    currentUser = signal<User | null>(user);
    updateProfile = vi.fn(async (changes: { name: string; phone: string | null }) => {
      const updated = { ...user, ...changes };
      currentUser.set(updated);
      return updated;
    });
    updateCompanyProfile = vi.fn(async (changes: CompanyProfile) => changes);
    changePassword = vi.fn(async () => undefined);

    await TestBed.configureTestingModule({
      imports: [ProfilePage],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            currentUser,
            setCurrentUser: (updated: User) => currentUser.set(updated),
            sessionExpiresAt: signal<number | null>(Date.now() + 60_000),
            canAccess: (page: string) => page !== 'activity' || canAccessActivity(),
            logout: vi.fn(async () => undefined),
          },
        },
        {
          provide: AdminApiService,
          useValue: {
            getAuditEvents,
            errorMessage: (_error: unknown, fallback: string) => fallback,
          },
        },
        {
          provide: ProfileApiService,
          useValue: {
            avatarImageUrl: signal<string | null>(null),
            avatarLoadError: signal<string | null>(null),
            updateProfile,
            uploadAvatar: vi.fn(),
            prepareAvatarImage: vi.fn(async (image: Blob) => image),
            removeAvatar: vi.fn(),
            getCompanyProfile: vi.fn(async () => ({
              companyName: '',
              phone: '',
              email: '',
              gstin: '',
            })),
            updateCompanyProfile,
            changePassword,
            getApiHealth: vi.fn(async () => ({
              status: 'ok',
              time: '2026-11-20T10:00:00.000Z',
            })),
          },
        },
        {
          provide: ThemeService,
          useValue: { mode: signal<'light' | 'dark'>('light'), toggleMode: vi.fn() },
        },
      ],
    }).compileComponents();
  });

  it('switches between profile sections', () => {
    const fixture = TestBed.createComponent(ProfilePage);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    element.querySelector<HTMLButtonElement>('#profile-tab-personal')!.click();
    fixture.detectChanges();
    expect(element.querySelector('.personal-columns h2')?.textContent).toContain('Personal information');

    element.querySelector<HTMLButtonElement>('#profile-tab-security')!.click();
    fixture.detectChanges();
    expect(element.querySelector('.security-columns h2')?.textContent).toContain('Session security');
  });

  it('supports keyboard navigation between profile tabs', () => {
    const fixture = TestBed.createComponent(ProfilePage);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const overviewTab = element.querySelector<HTMLButtonElement>('#profile-tab-overview')!;

    overviewTab.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    fixture.detectChanges();

    expect(element.querySelector('[role="tab"][aria-selected="true"]')?.id).toBe('profile-tab-personal');
  });

  it('keeps the photo control on the avatar and exposes the API heartbeat accurately', async () => {
    const fixture = TestBed.createComponent(ProfilePage);
    await fixture.whenStable();
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const fileInput = element.querySelector<HTMLInputElement>('input[type="file"]')!;
    const click = vi.spyOn(fileInput, 'click');

    element.querySelector<HTMLButtonElement>('.avatar-camera')!.click();
    fixture.detectChanges();

    expect(click).toHaveBeenCalledOnce();
    expect(fileInput.className).toContain('avatar-file-input');
    expect(getComputedStyle(fileInput).position).toBe('absolute');
    expect(element.querySelector('.photo-card')).toBeNull();
    expect(element.querySelector('.health-inline')?.textContent).toContain('API heartbeat reachable');
    expect(element.querySelector('.health-inline')?.textContent).toContain('not a database health check');
  });

  it('saves editable name and phone details without changing the sign-in email', async () => {
    const fixture = TestBed.createComponent(ProfilePage);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    element.querySelector<HTMLButtonElement>('#profile-tab-personal')!.click();
    fixture.detectChanges();
    element.querySelector<HTMLButtonElement>('.refresh-button')!.click();
    fixture.detectChanges();

    const email = element.querySelector<HTMLInputElement>('#profile-email')!;
    expect(email.readOnly).toBe(true);
    const name = element.querySelector<HTMLInputElement>('#profile-name')!;
    name.value = 'Ada Lovelace';
    name.dispatchEvent(new Event('input', { bubbles: true }));
    const phone = element.querySelector<HTMLInputElement>('#profile-phone')!;
    phone.value = '+91 12345 67890';
    phone.dispatchEvent(new Event('input', { bubbles: true }));
    element.querySelector<HTMLFormElement>('.profile-form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(updateProfile).toHaveBeenCalledWith({ name: 'Ada Lovelace', phone: '+91 12345 67890' });
    expect(currentUser()?.name).toBe('Ada Lovelace');
    expect(currentUser()?.phone).toBe('+91 12345 67890');
    expect(element.querySelector('.profile-success')?.textContent).toContain('saved');
  });

  it('loads only the current account activity', async () => {
    const fixture = TestBed.createComponent(ProfilePage);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    element.querySelector<HTMLButtonElement>('#profile-tab-activity')!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(getAuditEvents).toHaveBeenCalledOnce();
    expect(element.querySelectorAll('.activity-row')).toHaveLength(1);
    expect(element.querySelector('.activity-row')?.textContent).toContain('Auth Login Succeeded');
  });

  it('edits shared company details in the existing personal information card', async () => {
    const fixture = TestBed.createComponent(ProfilePage);
    await fixture.whenStable();
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    element.querySelector<HTMLButtonElement>('#profile-tab-personal')!.click();
    fixture.detectChanges();
    element.querySelector<HTMLButtonElement>('.company-heading .refresh-button')!.click();
    fixture.detectChanges();
    const companyName = element.querySelector<HTMLInputElement>('#company-name')!;
    companyName.value = 'Gravity Energy';
    companyName.dispatchEvent(new Event('input', { bubbles: true }));
    element.querySelector<HTMLFormElement>('.company-form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(updateCompanyProfile).toHaveBeenCalledWith({
      companyName: 'Gravity Energy',
      phone: '',
      email: '',
      gstin: '',
    });
    expect(element.querySelector('.personal-columns .profile-card')?.textContent).toContain('Gravity Energy');
    expect(element.querySelectorAll('.personal-columns .profile-card')).toHaveLength(1);
  });

  it('does not render a profile access tab or page directory', async () => {
    const fixture = TestBed.createComponent(ProfilePage);
    await fixture.whenStable();
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('#profile-tab-access')).toBeNull();
    expect(element.querySelector('#profile-panel-access')).toBeNull();
    expect(element.querySelector('.access-card')).toBeNull();
  });

  it('requires matching new-password confirmation before calling the API', async () => {
    const fixture = TestBed.createComponent(ProfilePage);
    await fixture.whenStable();
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    element.querySelector<HTMLButtonElement>('#profile-tab-security')!.click();
    fixture.detectChanges();
    for (const [selector, value] of [
      ['#current-password', 'Current-password-123'],
      ['#new-password', 'New-password-123'],
      ['#confirm-password', 'Different-password-123'],
    ]) {
      const input = element.querySelector<HTMLInputElement>(selector)!;
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    element.querySelector<HTMLFormElement>('.password-form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(changePassword).not.toHaveBeenCalled();
    expect(element.querySelector('.password-form .profile-error')?.textContent).toContain('do not match');
  });

  it('changes the password when current and new values are valid and confirmed', async () => {
    const fixture = TestBed.createComponent(ProfilePage);
    await fixture.whenStable();
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    element.querySelector<HTMLButtonElement>('#profile-tab-security')!.click();
    fixture.detectChanges();
    for (const [selector, value] of [
      ['#current-password', 'Current-password-123'],
      ['#new-password', 'New-password-123'],
      ['#confirm-password', 'New-password-123'],
    ]) {
      const input = element.querySelector<HTMLInputElement>(selector)!;
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    element.querySelector<HTMLFormElement>('.password-form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(changePassword).toHaveBeenCalledWith({
      currentPassword: 'Current-password-123',
      newPassword: 'New-password-123',
    });
    expect(element.querySelector('.password-form .profile-success')?.textContent).toContain('remains active');
  });

  it('hides account activity when the user lacks permission', () => {
    canAccessActivity.set(false);
    const fixture = TestBed.createComponent(ProfilePage);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('#profile-tab-activity')).toBeNull();
    expect(getAuditEvents).not.toHaveBeenCalled();
  });
});
