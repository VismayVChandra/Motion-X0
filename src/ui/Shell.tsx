import type { ComponentChildren } from 'preact';
import { device } from '../device/instance';
import { t } from '../i18n';
import { hrefFor, route, TAB_FOR, type Route } from '../router';
import { settingsStore } from '../store/settings';
import { Icon, type IconName } from './Icon';
import { effectiveTheme } from './theme';

const NAV: { route: Route; key: string; icon: IconName }[] = [
  { route: 'home', key: 'nav.home', icon: 'house' },
  { route: 'device', key: 'nav.device', icon: 'gauge' },
  { route: 'history', key: 'nav.history', icon: 'chartColumn' },
  { route: 'settings', key: 'nav.settings', icon: 'settings' },
];

export function StatusBadge() {
  const link = device.link.value;
  const demo = device.kind.value === 'sim';
  if (link === 'connected')
    return demo ? (
      <span class="badge neutral" role="status">
        <Icon name="flask" />
        {t('status.demo')}
      </span>
    ) : (
      <span class="badge ok" role="status">
        <Icon name="wifi" />
        {t('status.connected')}
      </span>
    );
  if (link === 'connecting')
    return (
      <span class="badge warn spin" role="status">
        <Icon name="loader" />
        {t('status.connecting')}
      </span>
    );
  if (link === 'lost')
    return (
      <span class="badge danger" role="status">
        <Icon name="wifiOff" />
        {t('status.lost')}
      </span>
    );
  return (
    <span class="badge neutral" role="status">
      <Icon name="wifiOff" />
      {t('status.offline')}
    </span>
  );
}

/** Pinned above the tab bar on every screen while the motor is (or was last seen) active. */
export function EStopBar() {
  if (!device.active.value) return null;
  return (
    <div class="estop-wrap">
      <button type="button" class="btn-estop" onClick={() => device.emergencyStop()}>
        <Icon name="octagonX" />
        <span>
          <strong>{t('estop.title')}</strong>
          <small>{t('estop.hint')}</small>
        </span>
      </button>
    </div>
  );
}

export function Notice() {
  return (
    <p class="notice" role="note">
      <Icon name="info" />
      {t('notice')}
    </p>
  );
}

export function Topbar() {
  const theme = effectiveTheme(settingsStore.settings.value.theme);
  return (
    <header class="topbar">
      <a class="logo" href={hrefFor('home')} aria-label={t('a11y.home')}>
        <span class="logo-mark">
          <Icon name="activity" />
        </span>
        <span class="logo-word">
          MOTION<span>-X</span>
        </span>
      </a>
      <div class="topbar-right">
        <StatusBadge />
        <button
          type="button"
          class="icon-btn"
          aria-label={theme === 'dark' ? t('theme.toLight') : t('theme.toDark')}
          onClick={() => settingsStore.update({ theme: theme === 'dark' ? 'light' : 'dark' })}
        >
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
        </button>
      </div>
    </header>
  );
}

export function Shell({ children }: { children: ComponentChildren }) {
  const current = TAB_FOR[route.value];
  const wide =
    (route.value === 'home' && settingsStore.settings.value.role === 'therapist') || route.value === 'report';

  return (
    <div class={`app${wide ? ' wide' : ''}`}>
      <Topbar />
      <main class="screen-body" id="main">
        {children}
      </main>
      <footer class="bottombar">
        <EStopBar />
        <Notice />
        <nav class="tabbar" aria-label={t('a11y.mainNav')}>
          {NAV.map((item) => (
            <a
              key={item.route}
              href={hrefFor(item.route)}
              class="tab"
              aria-current={current === item.route ? 'page' : undefined}
            >
              <span class="tab-ic">
                <Icon name={item.icon} />
              </span>
              {t(item.key)}
            </a>
          ))}
        </nav>
      </footer>
    </div>
  );
}
