import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AdminApiService } from '../../../../core/services/admin-api.service';
import { AuthService } from '../../../../core/services/auth.service';
import { ProfileApiService } from '../../../../core/services/profile-api.service';
import { ThemeService } from '../../../../core/services/theme.service';
import type { AuditEntry, CompanyProfile, Role } from '../../../../core/models/user.model';

type ProfileTab = 'overview' | 'personal' | 'security' | 'activity' | 'preferences';

const PROFILE_TABS: Array<{ id: ProfileTab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'personal', label: 'Personal info' },
  { id: 'security', label: 'Security' },
  { id: 'activity', label: 'Activity' },
  { id: 'preferences', label: 'Preferences' },
];

const EMPTY_COMPANY_PROFILE: CompanyProfile = {
  companyName: '',
  phone: '',
  email: '',
  gstin: '',
};

@Component({
  selector: 'app-profile-page',
  imports: [RouterLink],
  templateUrl: './profile-page.html',
  styleUrl: './profile-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfilePage {
  private readonly auth = inject(AuthService);
  private readonly api = inject(AdminApiService);
  private readonly profileApi = inject(ProfileApiService);
  private readonly router = inject(Router);
  private companyProfileBeforeEdit: CompanyProfile = { ...EMPTY_COMPANY_PROFILE };

  readonly user = this.auth.currentUser;
  readonly avatarImageUrl = this.profileApi.avatarImageUrl;
  readonly avatarLoadError = this.profileApi.avatarLoadError;
  readonly sessionExpiresAt = this.auth.sessionExpiresAt;
  readonly theme = inject(ThemeService);
  readonly logoutError = signal<string | null>(null);
  readonly activeTab = signal<ProfileTab>('overview');
  readonly editingProfile = signal(false);
  readonly profileName = signal('');
  readonly profilePhone = signal('');
  readonly profileSaving = signal(false);
  readonly profileError = signal<string | null>(null);
  readonly profileSaved = signal(false);
  readonly companyProfile = signal<CompanyProfile>({ ...EMPTY_COMPANY_PROFILE });
  readonly companyLoading = signal(true);
  readonly companyEditing = signal(false);
  readonly companySaving = signal(false);
  readonly companyError = signal<string | null>(null);
  readonly companySaved = signal(false);
  readonly passwordCurrent = signal('');
  readonly passwordNew = signal('');
  readonly passwordConfirm = signal('');
  readonly passwordSaving = signal(false);
  readonly passwordError = signal<string | null>(null);
  readonly passwordSaved = signal(false);
  readonly apiHealth = signal<'loading' | 'online' | 'offline'>('loading');
  readonly apiHealthTime = signal<string | null>(null);
  readonly apiHealthError = signal<string | null>(null);
  readonly avatarLoading = signal(false);
  readonly avatarError = signal<string | null>(null);
  readonly avatarSaved = signal(false);
  readonly activityLoading = signal(false);
  readonly activityLoaded = signal(false);
  readonly activityError = signal<string | null>(null);
  readonly activityEvents = signal<AuditEntry[]>([]);
  readonly canViewActivity = computed(() => this.auth.canAccess('activity'));
  readonly profileTabs = computed(() =>
    PROFILE_TABS.filter((tab) => tab.id !== 'activity' || this.canViewActivity()),
  );
  readonly canEditCompany = computed(() => !!this.user()?.permissions.settings.edit);
  readonly recentActivity = computed(() => {
    const account = this.user();
    if (!account) return [];
    return this.activityEvents()
      .filter((event) =>
        event.actorId === account.id ||
        event.actorEmail?.toLowerCase() === account.email.toLowerCase(),
      )
      .sort((a, b) => (Date.parse(b.at) || 0) - (Date.parse(a.at) || 0))
      .slice(0, 8);
  });

  constructor() {
    this.resetProfileForm();
    void this.loadCompanyProfile();
    void this.loadApiHealth();
  }

  readInput(event: Event): string {
    return event.target instanceof HTMLInputElement ? event.target.value : '';
  }

  editProfile(): void {
    this.resetProfileForm();
    this.profileError.set(null);
    this.profileSaved.set(false);
    this.editingProfile.set(true);
  }

  cancelProfileEdit(): void {
    this.resetProfileForm();
    this.profileError.set(null);
    this.editingProfile.set(false);
  }

  async saveProfile(event: Event): Promise<void> {
    event.preventDefault();
    if (this.profileSaving()) return;

    this.profileSaving.set(true);
    this.profileError.set(null);
    this.profileSaved.set(false);
    try {
      const user = await this.profileApi.updateProfile({
        name: this.profileName().trim(),
        phone: this.profilePhone().trim() || null,
      });
      this.auth.setCurrentUser(user);
      this.profileName.set(user.name);
      this.profilePhone.set(user.phone ?? '');
      this.editingProfile.set(false);
      this.profileSaved.set(true);
    } catch (error) {
      this.profileError.set(this.api.errorMessage(error, 'Unable to save your profile.'));
    } finally {
      this.profileSaving.set(false);
    }
  }

  editCompanyProfile(): void {
    this.companyProfileBeforeEdit = { ...this.companyProfile() };
    this.companyError.set(null);
    this.companySaved.set(false);
    this.companyEditing.set(true);
  }

  cancelCompanyEdit(): void {
    this.companyError.set(null);
    this.companyProfile.set({ ...this.companyProfileBeforeEdit });
    this.companyEditing.set(false);
  }

  updateCompanyField(field: keyof CompanyProfile, event: Event): void {
    this.companyProfile.update((profile) => ({
      ...profile,
      [field]: this.readInput(event),
    }));
  }

  async saveCompanyProfile(event: Event): Promise<void> {
    event.preventDefault();
    if (this.companySaving()) return;
    this.companySaving.set(true);
    this.companyError.set(null);
    this.companySaved.set(false);
    try {
      const profile = this.companyProfile();
      this.companyProfile.set(await this.profileApi.updateCompanyProfile({
        companyName: profile.companyName.trim(),
        phone: profile.phone.trim(),
        email: profile.email.trim(),
        gstin: profile.gstin.trim(),
      }));
      this.companyProfileBeforeEdit = { ...this.companyProfile() };
      this.companyEditing.set(false);
      this.companySaved.set(true);
    } catch (error) {
      this.companyError.set(this.api.errorMessage(error, 'Unable to save company information.'));
    } finally {
      this.companySaving.set(false);
    }
  }

  async loadCompanyProfile(): Promise<void> {
    this.companyLoading.set(true);
    try {
      const profile = await this.profileApi.getCompanyProfile();
      this.companyProfile.set(profile);
      this.companyProfileBeforeEdit = { ...profile };
    } catch (error) {
      this.companyError.set(this.api.errorMessage(error, 'Unable to load company information.'));
    } finally {
      this.companyLoading.set(false);
    }
  }

  async savePassword(event: Event): Promise<void> {
    event.preventDefault();
    if (this.passwordSaving()) return;
    this.passwordError.set(null);
    this.passwordSaved.set(false);
    if (this.passwordNew() !== this.passwordConfirm()) {
      this.passwordError.set('The new passwords do not match.');
      return;
    }
    this.passwordSaving.set(true);
    try {
      await this.profileApi.changePassword({
        currentPassword: this.passwordCurrent(),
        newPassword: this.passwordNew(),
      });
      this.passwordCurrent.set('');
      this.passwordNew.set('');
      this.passwordConfirm.set('');
      this.passwordSaved.set(true);
    } catch (error) {
      this.passwordError.set(this.api.errorMessage(error, 'Unable to change your password.'));
    } finally {
      this.passwordSaving.set(false);
    }
  }

  async loadApiHealth(): Promise<void> {
    this.apiHealth.set('loading');
    this.apiHealthError.set(null);
    try {
      const health = await this.profileApi.getApiHealth();
      if (health.status !== 'ok') throw new Error('The API did not report a healthy heartbeat.');
      this.apiHealthTime.set(health.time);
      this.apiHealth.set('online');
    } catch (error) {
      this.apiHealth.set('offline');
      this.apiHealthError.set(this.api.errorMessage(error, 'API heartbeat could not be reached.'));
    }
  }

  async selectAvatar(event: Event): Promise<void> {
    const input = event.target instanceof HTMLInputElement ? event.target : null;
    const file = input?.files?.[0];
    if (input) input.value = '';
    if (!file) return;
    this.avatarError.set(null);
    this.avatarSaved.set(false);
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      this.avatarError.set('Choose a JPEG, PNG, or WebP image.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      this.avatarError.set('Choose an image smaller than 10 MB.');
      return;
    }

    this.avatarLoading.set(true);
    try {
      const image = await this.profileApi.prepareAvatarImage(file);
      this.auth.setCurrentUser(await this.profileApi.uploadAvatar(image));
      this.avatarSaved.set(true);
    } catch (error) {
      const fallback = error instanceof Error ? error.message : 'Unable to save this photo. Try a different image.';
      this.avatarError.set(this.api.errorMessage(error, fallback));
    } finally {
      this.avatarLoading.set(false);
    }
  }

  async removeAvatar(): Promise<void> {
    if (this.avatarLoading()) return;
    this.avatarLoading.set(true);
    this.avatarError.set(null);
    this.avatarSaved.set(false);
    try {
      this.auth.setCurrentUser(await this.profileApi.removeAvatar());
      this.avatarSaved.set(true);
    } catch (error) {
      this.avatarError.set(this.api.errorMessage(error, 'Unable to remove your profile photo.'));
    } finally {
      this.avatarLoading.set(false);
    }
  }

  selectTab(tab: ProfileTab): void {
    if (tab === 'activity' && !this.canViewActivity()) return;
    this.activeTab.set(tab);
    if (tab === 'activity') void this.loadActivity();
  }

  onTabKeydown(event: KeyboardEvent, tab: ProfileTab): void {
    const tabs = this.profileTabs();
    const currentIndex = tabs.findIndex((item) => item.id === tab);
    let nextIndex: number;
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = tabs.length - 1;
    else return;

    event.preventDefault();
    this.selectTab(tabs[nextIndex].id);
    const buttons = (event.currentTarget as HTMLButtonElement).parentElement
      ?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    buttons?.[nextIndex]?.focus();
  }

  async loadActivity(force = false): Promise<void> {
    if (!this.canViewActivity() || this.activityLoading() || (this.activityLoaded() && !force)) return;
    this.activityLoading.set(true);
    this.activityError.set(null);
    try {
      this.activityEvents.set(await this.api.getAuditEvents());
      this.activityLoaded.set(true);
    } catch (error) {
      this.activityError.set(this.api.errorMessage(error, 'Unable to load your account activity.'));
    } finally {
      this.activityLoading.set(false);
    }
  }

  roleLabel(role: Role): string {
    return role === 'superadmin' ? 'Superadmin' : role === 'admin' ? 'Admin' : 'Viewer';
  }

  formatDate(value: number | null): string {
    return value
      ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(value)
      : 'Not available';
  }

  formatProfileDate(value: string): string {
    const timestamp = Date.parse(value);
    return Number.isNaN(timestamp)
      ? 'Not available'
      : new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(timestamp);
  }

  formatHealthTime(value: string | null): string {
    const timestamp = value ? Date.parse(value) : Number.NaN;
    return Number.isNaN(timestamp)
      ? 'Time unavailable'
      : new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(timestamp);
  }

  formatActivityDate(value: string): string {
    const timestamp = Date.parse(value);
    return Number.isNaN(timestamp)
      ? 'Time unavailable'
      : new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(timestamp);
  }

  activityLabel(action: string): string {
    return action
      .replaceAll('.', ' ')
      .replaceAll('_', ' ')
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  activityDetails(event: AuditEntry): string {
    const target = event.targetType ? `${event.targetType} ${event.targetId}` : event.targetId;
    const details = Object.entries(event.details)
      .map(([key, value]) => `${key}: ${String(value)}`)
      .join(' · ');
    return [target, details].filter(Boolean).join(' · ');
  }

  async logout(): Promise<void> {
    this.logoutError.set(null);
    try {
      await this.auth.logout();
      await this.router.navigateByUrl('/auth/login');
    } catch {
      this.logoutError.set('Unable to sign out. Check the API connection and try again.');
    }
  }

  private resetProfileForm(): void {
    const account = this.user();
    this.profileName.set(account?.name ?? '');
    this.profilePhone.set(account?.phone ?? '');
  }

}
