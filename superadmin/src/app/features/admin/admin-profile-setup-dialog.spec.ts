import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AdminApiService } from '../../core/services/admin-api.service';
import { AuthService } from '../../core/services/auth.service';
import { ProfileApiService } from '../../core/services/profile-api.service';
import { PAGE_KEYS, type RolePermissions, type User } from '../../core/models/user.model';
import { AdminProfileSetupDialog } from './admin-profile-setup-dialog';

const permissions = Object.fromEntries(
  PAGE_KEYS.map((key) => [key, { view: true, create: true, edit: true, delete: true }]),
) as RolePermissions;

describe('AdminProfileSetupDialog', () => {
  it('requires first-login details and completes setup without changing the assigned email', async () => {
    const user: User = {
      id: 'admin-1',
      userCode: '123-AB_',
      name: 'New Admin',
      email: 'assigned@example.test',
      phone: null,
      role: 'admin',
      profileSetupRequired: true,
      avatarInitials: 'NA',
      avatarUrl: '/api/superadmin/console/auth/profile/avatar',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      accessMode: 'role',
      permissionsAssignedBy: null,
      permissions,
    };
    const currentUser = signal<User | null>(user);
    const updateProfile = vi.fn(async (changes: {
      name: string;
      phone: string | null;
      completeSetup?: boolean;
    }) => {
      const updated = { ...user, ...changes, profileSetupRequired: false };
      currentUser.set(updated);
      return updated;
    });

    await TestBed.configureTestingModule({
      imports: [AdminProfileSetupDialog],
      providers: [
        {
          provide: AuthService,
          useValue: {
            currentUser,
            impersonation: signal(null),
            setCurrentUser: (updated: User) => currentUser.set(updated),
          },
        },
        {
          provide: AdminApiService,
          useValue: { errorMessage: (_error: unknown, fallback: string) => fallback },
        },
        {
          provide: ProfileApiService,
          useValue: {
            avatarImageUrl: signal<string | null>(null),
            prepareAvatarImage: vi.fn(),
            uploadAvatar: vi.fn(),
            updateProfile,
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AdminProfileSetupDialog);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('[role="dialog"]')).not.toBeNull();
    const email = element.querySelector<HTMLInputElement>('#setup-email')!;
    expect(email.value).toBe('assigned@example.test');
    expect(email.readOnly).toBe(true);

    const name = element.querySelector<HTMLInputElement>('#setup-name')!;
    name.value = 'Ada Administrator';
    name.dispatchEvent(new Event('input', { bubbles: true }));
    const phone = element.querySelector<HTMLInputElement>('#setup-phone')!;
    phone.value = '+91 98765 43210';
    phone.dispatchEvent(new Event('input', { bubbles: true }));
    element.querySelector<HTMLFormElement>('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(updateProfile).toHaveBeenCalledWith({
      name: 'Ada Administrator',
      phone: '+91 98765 43210',
      completeSetup: true,
    });
    expect(currentUser()?.profileSetupRequired).toBe(false);
    expect(element.querySelector('[role="dialog"]')).toBeNull();
  });
});
