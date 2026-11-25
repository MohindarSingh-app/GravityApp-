
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { AuthService } from '../../../../core/services/auth.service';

@Component({
  selector: 'app-settings-page',
  imports: [],
  templateUrl: './settings-page.html',
  styleUrl: './settings-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsPage {
  private auth = inject(AuthService);

  readonly saved = signal(false);

  readonly settings = signal({
    sessionHours: 8,
    maxAttempts: 5,
    lockMinutes: 15,
    requireStrongPassword: true,
    emailAlerts: true,
  });

  save(): void {
    // TODO: persist settings to backend
    this.saved.set(true);
    setTimeout(() => this.saved.set(false), 2000);
  }
}
