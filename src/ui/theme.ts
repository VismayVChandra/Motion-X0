import { effect, signal } from '@preact/signals';
import { settingsStore, type ThemePref } from '../store/settings';

const media = typeof matchMedia === 'undefined' ? null : matchMedia('(prefers-color-scheme: dark)');
const systemDark = signal(media?.matches ?? false);
media?.addEventListener('change', (e) => (systemDark.value = e.matches));

/** The theme actually shown, resolving 'system' via the OS preference. */
export function effectiveTheme(pref: ThemePref): 'light' | 'dark' {
  if (pref !== 'system') return pref;
  return systemDark.value ? 'dark' : 'light';
}

/** Reflect the theme preference on <html data-theme>. 'system' removes it so the media query decides. */
export function startThemeSync(): void {
  effect(() => {
    const theme = settingsStore.settings.value.theme;
    const root = document.documentElement;
    if (theme === 'system') delete root.dataset.theme;
    else root.dataset.theme = theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    meta?.setAttribute('content', effectiveTheme(theme) === 'dark' ? '#0a1211' : '#f4f7f6');
  });
}
