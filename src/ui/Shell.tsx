import type { ComponentChildren } from 'preact';
import { hrefFor, route, type Route } from '../router';
import { settingsStore } from '../store/settings';
import { nextTheme } from './theme';
import { Icon, type IconName } from './Icon';

const NAV: { route: Route; label: string; icon: IconName }[] = [
  { route: 'home', label: 'Home', icon: 'home' },
  { route: 'device', label: 'Device', icon: 'device' },
  { route: 'history', label: 'History', icon: 'chart' },
  { route: 'settings', label: 'Settings', icon: 'settings' },
];

const THEME_LABEL = { system: 'Theme: system', light: 'Theme: light', dark: 'Theme: dark' } as const;
const THEME_ICON = { system: 'auto', light: 'sun', dark: 'moon' } as const;

export function Shell({ children }: { children: ComponentChildren }) {
  const { theme, demoMode } = settingsStore.settings.value;
  const current = route.value;

  return (
    <div class="shell">
      <header class="topbar">
        <a class="brand" href={hrefFor('home')} aria-label="MOTION-X home">
          <span class="brand-mark" aria-hidden="true" />
          MOTION-X
        </a>
        {demoMode && <span class="badge badge-demo">Demo mode</span>}
        <button
          type="button"
          class="icon-btn"
          aria-label={`${THEME_LABEL[theme]}. Change theme`}
          title={THEME_LABEL[theme]}
          onClick={() => settingsStore.update({ theme: nextTheme(theme) })}
        >
          <Icon name={THEME_ICON[theme]} />
        </button>
      </header>

      <main class="content" id="main">
        {children}
      </main>

      <footer class="bottombar">
      <p class="notice" role="note">
        Not a medical device. Prototype. Use under supervision.
      </p>

      <nav class="tabbar" aria-label="Main">
        {NAV.map((item) => (
          <a
            key={item.route}
            href={hrefFor(item.route)}
            class="tab"
            aria-current={current === item.route ? 'page' : undefined}
          >
            <Icon name={item.icon} />
            <span>{item.label}</span>
          </a>
        ))}
      </nav>
      </footer>
    </div>
  );
}
