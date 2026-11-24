import { Injectable, signal } from '@angular/core';

const MODE_KEY = 'adminuiuxlayoutmode';
const LEGACY_KEYS = [
  'adminuiuxtheme',
  'adminuiuxbggradient',
  'adminuiuxsidebarfilled',
  'adminuiuxsidebarlayout',
  'adminuiuxheaderfilled',
  'adminuiuxheaderlayout',
  'adminuiuxsetimagepath',
  'adminuiuxliquidGlass',
];

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly mode = signal<'light' | 'dark'>('light');

  init(): void {
    const body = document.body;
    const oldAppearanceClasses = Array.from(body.classList).filter(
      (className) =>
        className.startsWith('theme-') ||
        className.startsWith('bg-gradient-') ||
        className.startsWith('adminuiux-sidebar-') ||
        className.startsWith('adminuiux-header-') ||
        className === 'bg-r-gradient' ||
        className === 'bg-l-gradient' ||
        className === 'bg-white' ||
        className === 'main-bg' ||
        className === 'main-bg-opac' ||
        className === 'main-bg-blur' ||
        className === 'liquid-glass-ui',
    );
    body.classList.remove(...oldAppearanceClasses);
    body.style.removeProperty('--main-bg');
    delete body.dataset['theme'];
    delete body.dataset['bggradient'];
    delete body.dataset['sidebarfill'];
    delete body.dataset['sidebarlayout'];
    delete body.dataset['headerfill'];
    delete body.dataset['headerlayout'];
    LEGACY_KEYS.forEach((key) => localStorage.removeItem(key));

    this.applyMode(localStorage.getItem(MODE_KEY) === 'dark' ? 'dark' : 'light');
  }

  toggleMode(): void {
    this.applyMode(this.mode() === 'dark' ? 'light' : 'dark');
  }

  private applyMode(mode: 'light' | 'dark'): void {
    const html = document.documentElement;
    html.setAttribute('data-mode', mode);
    html.setAttribute('data-bs-theme', mode);
    this.mode.set(mode);
    localStorage.setItem(MODE_KEY, mode);
  }
}
