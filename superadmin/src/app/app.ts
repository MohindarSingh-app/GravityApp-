import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './core/services/theme.service';

@Component({
  imports: [RouterOutlet],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App implements OnInit {
  private readonly theme = inject(ThemeService);
  protected readonly title = signal('energy-hub-superadmin');

  ngOnInit(): void {
    this.theme.init();
  }
}
