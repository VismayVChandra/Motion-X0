import { effect, signal } from '@preact/signals';
import { lang, meta } from '../i18n';
import { settingsStore, type ThemePref } from '../store/settings';

const media = typeof matchMedia === 'undefined' ? null : matchMedia('(prefers-color-scheme: dark)');
const systemDark = signal(media?.matches ?? false);
media?.addEventListener('change', (e) => (systemDark.value = e.matches));

/** The theme actually shown, resolving 'system' via the OS preference. */
export function effectiveTheme(pref: ThemePref): 'light' | 'dark' {
  if (pref !== 'system') return pref;
  return systemDark.value ? 'dark' : 'light';
}

/**
 * Reflect display settings on <html>: data-theme (always the resolved light/dark, so
 * high-contrast tokens can target it), data-contrast, and lang for screen readers/fonts.
 */
export function startThemeSync(): void {
  effect(() => {
    const s = settingsStore.settings.value;
    const theme = effectiveTheme(s.theme);
    const root = document.documentElement;
    root.dataset.theme = theme;
    if (s.highContrast) root.dataset.contrast = 'high';
    else delete root.dataset.contrast;
    root.lang = lang.value;
    root.dir = 'ltr';
    document.title = 'MOTION-X';
    void meta.value;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0a1211' : '#f4f7f6');
  });
}
