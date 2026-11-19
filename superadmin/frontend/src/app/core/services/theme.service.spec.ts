import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-mode');
    document.documentElement.removeAttribute('data-bs-theme');
    document.body.className = '';
  });

  it('restores dark mode and removes legacy personalization', () => {
    localStorage.setItem('adminuiuxlayoutmode', 'dark');
    localStorage.setItem('adminuiuxtheme', 'theme-pink');
    localStorage.setItem('adminuiuxbggradient', 'bg-gradient-4');
    document.body.classList.add('theme-pink', 'bg-gradient-4', 'liquid-glass-ui');

    const theme = TestBed.inject(ThemeService);
    theme.init();

    expect(theme.mode()).toBe('dark');
    expect(document.documentElement.getAttribute('data-mode')).toBe('dark');
    expect(document.body.classList.contains('theme-pink')).toBe(false);
    expect(document.body.classList.contains('bg-gradient-4')).toBe(false);
    expect(document.body.classList.contains('liquid-glass-ui')).toBe(false);
    expect(localStorage.getItem('adminuiuxtheme')).toBeNull();
    expect(localStorage.getItem('adminuiuxbggradient')).toBeNull();
  });

  it('toggles and persists only light and dark modes', () => {
    const theme = TestBed.inject(ThemeService);
    theme.init();

    expect(theme.mode()).toBe('light');
    theme.toggleMode();
    expect(theme.mode()).toBe('dark');
    expect(localStorage.getItem('adminuiuxlayoutmode')).toBe('dark');
    theme.toggleMode();
    expect(theme.mode()).toBe('light');
    expect(localStorage.getItem('adminuiuxlayoutmode')).toBe('light');
  });
});
