import type { ComponentChildren } from 'preact';
import { device } from '../device/instance';
import { hrefFor, route, TAB_FOR, type Route } from '../router';
import { settingsStore } from '../store/settings';
import { Icon, type IconName } from './Icon';
import { effectiveTheme } from './theme';

const NAV: { route: Route; label: string; icon: IconName }[] = [
  { route: 'home', label: 'Home', icon: 'house' },
  { route: 'device', label: 'Device', icon: 'gauge' },
  { route: 'history', label: 'History', icon: 'chartColumn' },
  { route: 'settings', label: 'Settings', icon: 'settings' },
];

export function StatusBadge() {
  const link = device.link.value;
  const demo = device.kind.value === 'sim';
  if (link === 'connected')
    return demo ? (
      <span class="badge neutral" role="status">
        <Icon name="flask" />
        Demo mode
      </span>
    ) : (
      <span class="badge ok" role="status">
        <Icon name="wifi" />
        Connected
      </span>
    );
  if (link === 'connecting')
    return (
      <span class="badge warn spin" role="status">
        <Icon name="loader" />
        Connecting
      </span>
    );
  if (link === 'lost')
    return (
      <span class="badge danger" role="status">
        <Icon name="wifiOff" />
        Connection lost
      </span>
    );
  return (
    <span class="badge neutral" role="status">
      <Icon name="wifiOff" />
      Not connected
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
          <strong>EMERGENCY STOP</strong>
          <small>Stops the motor immediately</small>
        </span>
      </button>
    </div>
  );
}

export function Shell({ children }: { children: ComponentChildren }) {
  const theme = effectiveTheme(settingsStore.settings.value.theme);
  const current = TAB_FOR[route.value];

  return (
    <div class="app">
      <header class="topbar">
        <a class="logo" href={hrefFor('home')} aria-label="MOTION-X home">
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
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            onClick={() => settingsStore.update({ theme: theme === 'dark' ? 'light' : 'dark' })}
          >
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
          </button>
        </div>
      </header>

      <main class="screen-body" id="main">
        {children}
      </main>

      <footer class="bottombar">
        <EStopBar />
        <p class="notice" role="note">
          <Icon name="info" />
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
              <span class="tab-ic">
                <Icon name={item.icon} />
              </span>
              {item.label}
            </a>
          ))}
        </nav>
      </footer>
    </div>
  );
}
