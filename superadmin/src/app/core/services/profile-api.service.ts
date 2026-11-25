import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { CompanyProfile, User } from '../models/user.model';

const API_PREFIX = '/api/superadmin/console';

interface ProfileResponse {
  user: User;
}

interface CompanyProfileResponse {
  companyProfile: CompanyProfile;
}

export interface ApiHealth {
  status: string;
  time: string;
}

@Injectable({ providedIn: 'root' })
export class ProfileApiService {
  private readonly http = inject(HttpClient);
  private avatarSourceUrl: string | null = null;
  private avatarObjectUrl: string | null = null;
  private avatarRequest: Promise<void> | null = null;

  readonly avatarImageUrl = signal<string | null>(null);
  readonly avatarLoadError = signal<string | null>(null);

  async updateProfile(
    changes: { name: string; phone: string | null; completeSetup?: boolean },
  ): Promise<User> {
    const body = {
      name: changes.name,
      phone: changes.phone,
      ...(changes.completeSetup ? { completeSetup: true } : {}),
    };
    const response = await firstValueFrom(
      this.http.patch<ProfileResponse>(
        `${API_PREFIX}/auth/profile`,
        body,
        { withCredentials: true },
      ),
    );
    return response.user;
  }

  async loadAvatar(avatarUrl: string | null): Promise<void> {
    if (avatarUrl === this.avatarSourceUrl &&
        (this.avatarImageUrl() || this.avatarRequest || !avatarUrl)) {
      if (this.avatarRequest) await this.avatarRequest;
      return;
    }

    this.avatarSourceUrl = avatarUrl;
    this.avatarRequest = null;
    this.avatarLoadError.set(null);
    this.avatarImageUrl.set(null);
    if (this.avatarObjectUrl) URL.revokeObjectURL(this.avatarObjectUrl);
    this.avatarObjectUrl = null;
    if (!avatarUrl) return;

    const request = firstValueFrom(
      this.http.get(avatarUrl, { responseType: 'blob', withCredentials: true }),
    )
      .then((image) => {
        if (this.avatarSourceUrl !== avatarUrl) return;
        this.avatarObjectUrl = URL.createObjectURL(image);
        this.avatarImageUrl.set(this.avatarObjectUrl);
      })
      .catch((error: unknown) => {
        if (this.avatarSourceUrl === avatarUrl) {
          this.avatarLoadError.set(
            error instanceof Error ? error.message : 'Unable to load your profile picture.',
          );
        }
      })
      .finally(() => {
        if (this.avatarSourceUrl === avatarUrl) this.avatarRequest = null;
      });
    this.avatarRequest = request;
    await request;
  }

  async prepareAvatarImage(file: File): Promise<Blob> {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const context = canvas.getContext('2d');
    if (!context) {
      bitmap.close();
      throw new Error('Your browser could not prepare this image.');
    }

    const side = Math.min(bitmap.width, bitmap.height);
    context.drawImage(
      bitmap,
      (bitmap.width - side) / 2,
      (bitmap.height - side) / 2,
      side,
      side,
      0,
      0,
      canvas.width,
      canvas.height,
    );
    bitmap.close();

    const image = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/webp', 0.86),
    );
    if (!image || image.size > 512 * 1024) {
      throw new Error('This image could not be compressed to the 512 KB limit.');
    }
    return image;
  }

  async uploadAvatar(image: Blob): Promise<User> {
    const response = await firstValueFrom(
      this.http.put<ProfileResponse>(
        `${API_PREFIX}/auth/profile/avatar`,
        image,
        {
          withCredentials: true,
          headers: { 'Content-Type': image.type },
        },
      ),
    );
    return response.user;
  }

  async removeAvatar(): Promise<User> {
    const response = await firstValueFrom(
      this.http.delete<ProfileResponse>(
        `${API_PREFIX}/auth/profile/avatar`,
        { withCredentials: true },
      ),
    );
    return response.user;
  }

  async getCompanyProfile(): Promise<CompanyProfile> {
    const response = await firstValueFrom(
      this.http.get<CompanyProfileResponse>(
        `${API_PREFIX}/auth/profile/company`,
        { withCredentials: true },
      ),
    );
    return response.companyProfile;
  }

  async updateCompanyProfile(companyProfile: CompanyProfile): Promise<CompanyProfile> {
    const response = await firstValueFrom(
      this.http.patch<CompanyProfileResponse>(
        `${API_PREFIX}/auth/profile/company`,
        companyProfile,
        { withCredentials: true },
      ),
    );
    return response.companyProfile;
  }

  async changePassword(input: { currentPassword: string; newPassword: string }): Promise<void> {
    await firstValueFrom(
      this.http.post<void>(
        `${API_PREFIX}/auth/profile/password`,
        input,
        { withCredentials: true },
      ),
    );
  }

  async getApiHealth(): Promise<ApiHealth> {
    return firstValueFrom(this.http.get<ApiHealth>('/api/health'));
  }
}
