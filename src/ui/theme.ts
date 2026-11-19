import { effect } from '@preact/signals';
import { settingsStore, type ThemePref } from '../store/settings';

/** Reflect the theme preference on <html data-theme>. 'system' removes it so the media query decides. */
export function startThemeSync(): void {
  effect(() => {
    const theme = settingsStore.settings.value.theme;
    const root = document.documentElement;
    if (theme === 'system') delete root.dataset.theme;
    else root.dataset.theme = theme;
  });
}

const ORDER: ThemePref[] = ['system', 'light', 'dark'];
export const nextTheme = (t: ThemePref): ThemePref => ORDER[(ORDER.indexOf(t) + 1) % ORDER.length];
