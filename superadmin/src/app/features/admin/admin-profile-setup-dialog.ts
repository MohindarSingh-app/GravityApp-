import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AdminApiService } from '../../core/services/admin-api.service';
import { AuthService } from '../../core/services/auth.service';
import { ProfileApiService } from '../../core/services/profile-api.service';

@Component({
  selector: 'app-admin-profile-setup-dialog',
  templateUrl: './admin-profile-setup-dialog.html',
  styleUrl: './admin-profile-setup-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminProfileSetupDialog {
  private readonly auth = inject(AuthService);
  private readonly api = inject(AdminApiService);
  private readonly profileApi = inject(ProfileApiService);

  readonly currentUser = this.auth.currentUser;
  readonly required = computed(() =>
    !!this.currentUser()?.profileSetupRequired && !this.auth.impersonation(),
  );
  readonly fullName = signal('');
  readonly phone = signal('');
  readonly selectedPhoto = signal<File | null>(null);
  readonly selectedPhotoUrl = signal<string | null>(null);
  readonly photoPreview = computed(() => this.selectedPhotoUrl() ?? this.profileApi.avatarImageUrl());
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  constructor() {
    const account = this.currentUser();
    if (account?.profileSetupRequired) {
      this.fullName.set(account.name);
      this.phone.set(account.phone ?? '');
    }
  }

  readInput(event: Event): string {
    return event.target instanceof HTMLInputElement ? event.target.value : '';
  }

  initials(): string {
    return (this.currentUser()?.avatarInitials || 'AD').slice(0, 2);
  }

  selectPhoto(event: Event): void {
    const input = event.target instanceof HTMLInputElement ? event.target : null;
    const file = input?.files?.[0] ?? null;
    if (input) input.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      this.error.set('Choose a JPEG, PNG, or WebP image.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      this.error.set('Choose an image smaller than 10 MB.');
      return;
    }
    const previousUrl = this.selectedPhotoUrl();
    if (previousUrl) URL.revokeObjectURL(previousUrl);
    this.selectedPhoto.set(file);
    this.selectedPhotoUrl.set(URL.createObjectURL(file));
    this.error.set(null);
  }

  async save(event: Event): Promise<void> {
    event.preventDefault();
    const account = this.currentUser();
    if (!account || !this.required() || this.saving()) return;

    const name = this.fullName().trim();
    const phone = this.phone().trim();
    if (name.length < 2 || name.length > 100) {
      this.error.set('Enter a full name between 2 and 100 characters.');
      return;
    }
    if (phone.length < 6 || phone.length > 32 || !/^[+()\d.\-\s]+$/.test(phone)) {
      this.error.set('Enter a valid contact number.');
      return;
    }
    if (!this.selectedPhoto() && !account.avatarUrl) {
      this.error.set('Add a profile picture to complete your setup.');
      return;
    }

    this.saving.set(true);
    this.error.set(null);
    try {
      const photo = this.selectedPhoto();
      if (photo) {
        const image = await this.profileApi.prepareAvatarImage(photo);
        this.auth.setCurrentUser(await this.profileApi.uploadAvatar(image));
      }
      this.auth.setCurrentUser(await this.profileApi.updateProfile({
        name,
        phone,
        completeSetup: true,
      }));
      const photoUrl = this.selectedPhotoUrl();
      if (photoUrl) URL.revokeObjectURL(photoUrl);
      this.selectedPhotoUrl.set(null);
      this.selectedPhoto.set(null);
    } catch (error) {
      const fallback = error instanceof Error
        ? error.message
        : 'Unable to save your profile. Please try again.';
      this.error.set(this.api.errorMessage(error, fallback));
    } finally {
      this.saving.set(false);
    }
  }
}
