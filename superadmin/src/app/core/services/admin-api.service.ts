import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  AdminUser,
  AuditEntry,
  PermissionMatrix,
  PlatformRegistration,
  PlatformRegistrationDetails,
  Role,
  RolePermissions,
} from '../models/user.model';

const API_PREFIX = '/api/superadmin/console';

export const ROLE_LABELS: Record<Role, string> = {
  superadmin: 'Superadmin',
  admin: 'Admin',
  viewer: 'Viewer',
};

export interface PageDefinition {
  key: keyof PermissionMatrix[Role];
  label: string;
  group: string;
}

export interface AccessRolesResponse {
  roles: Role[];
  pages: PageDefinition[];
  permissions: PermissionMatrix;
}

@Injectable({ providedIn: 'root' })
export class AdminApiService {
  private readonly http = inject(HttpClient);

  getOperations<T>(domain: string): Promise<T> {
    return firstValueFrom(
      this.http.get<T>(
        `${API_PREFIX}/admin/operations/${encodeURIComponent(domain)}`,
        { withCredentials: true },
      ),
    );
  }

  async getUsers(): Promise<AdminUser[]> {
    const response = await firstValueFrom(
      this.http.get<{ users: AdminUser[] }>(`${API_PREFIX}/admin/users`, { withCredentials: true }),
    );
    return response.users;
  }

  async createImpersonationLaunch(userId: string): Promise<{ launchToken: string }> {
    return firstValueFrom(
      this.http.post<{ launchToken: string }>(
        `${API_PREFIX}/admin/users/${encodeURIComponent(userId)}/impersonation`,
        {},
        { withCredentials: true },
      ),
    );
  }

  async getRegistrations(): Promise<PlatformRegistration[]> {
    const response = await firstValueFrom(
      this.http.get<{ registrations: PlatformRegistration[] }>(
        `${API_PREFIX}/admin/registrations`,
        { withCredentials: true },
      ),
    );
    return response.registrations;
  }

  async getRegistrationDetails(id: string): Promise<PlatformRegistrationDetails> {
    const response = await firstValueFrom(
      this.http.get<{ details: PlatformRegistrationDetails }>(
        `${API_PREFIX}/admin/registrations/${encodeURIComponent(id)}`,
        { withCredentials: true },
      ),
    );
    return response.details;
  }

  async reviewRegistration(
    id: string,
    decision: 'approved' | 'rejected',
    reason = '',
  ): Promise<{ id: string; status: string; reviewStage: 'initial' | 'profile' | null }> {
    const response = await firstValueFrom(
      this.http.post<{ registration: { id: string; status: string; reviewStage: 'initial' | 'profile' | null } }>(
        `${API_PREFIX}/admin/registrations/${encodeURIComponent(id)}/review`,
        { decision, reason },
        { withCredentials: true },
      ),
    );
    return response.registration;
  }

  async createUser(input: {
    name: string;
    email: string;
    password: string;
    role: Role;
  }): Promise<AdminUser> {
    const response = await firstValueFrom(
      this.http.post<{ user: AdminUser }>(`${API_PREFIX}/admin/users`, input, { withCredentials: true }),
    );
    return response.user;
  }

  async updateUser(
    id: string,
    changes: { role: Role; disabled: boolean },
  ): Promise<AdminUser> {
    const response = await firstValueFrom(
      this.http.patch<{ user: AdminUser }>(
        `${API_PREFIX}/admin/users/${encodeURIComponent(id)}`,
        changes,
        { withCredentials: true },
      ),
    );
    return response.user;
  }

  async deleteUser(id: string): Promise<void> {
    await firstValueFrom(
      this.http.delete<void>(
        `${API_PREFIX}/admin/users/${encodeURIComponent(id)}`,
        { withCredentials: true },
      ),
    );
  }

  async getUserPermissions(id: string): Promise<RolePermissions | null> {
    const response = await firstValueFrom(
      this.http.get<{ permissions: RolePermissions | null }>(
        `${API_PREFIX}/admin/users/${encodeURIComponent(id)}/permissions`,
        { withCredentials: true },
      ),
    );
    return response.permissions;
  }

  async updateUserPermissions(
    id: string,
    permissions: RolePermissions | null,
  ): Promise<RolePermissions | null> {
    const response = await firstValueFrom(
      this.http.put<{ permissions: RolePermissions | null }>(
        `${API_PREFIX}/admin/users/${encodeURIComponent(id)}/permissions`,
        { permissions },
        { withCredentials: true },
      ),
    );
    return response.permissions;
  }

  async getAccessRoles(): Promise<AccessRolesResponse> {
    return firstValueFrom(
      this.http.get<AccessRolesResponse>(`${API_PREFIX}/access/roles`, { withCredentials: true }),
    );
  }

  async updateRolePermissions(role: Role, permissions: RolePermissions): Promise<PermissionMatrix> {
    const response = await firstValueFrom(
      this.http.put<{ permissions: PermissionMatrix }>(
        `${API_PREFIX}/access/roles/${role}`,
        { permissions },
        { withCredentials: true },
      ),
    );
    return response.permissions;
  }

  async getAuditEvents(): Promise<AuditEntry[]> {
    const response = await firstValueFrom(
      this.http.get<{ events: AuditEntry[] }>(`${API_PREFIX}/admin/audit`, { withCredentials: true }),
    );
    return response.events;
  }

  errorMessage(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse) {
      const message = error.error && typeof error.error === 'object'
        ? (error.error as { message?: unknown }).message
        : undefined;
      if (typeof message === 'string') return message;
    }
    return fallback;
  }
}
