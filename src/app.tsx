import { route } from './router';
import { DeviceScreen } from './screens/DeviceScreen';
import { Home } from './screens/Home';
import { LiveSession } from './screens/LiveSession';
import { SessionDone } from './screens/SessionDone';
import { SessionSetup } from './screens/SessionSetup';
import { Settings } from './screens/Settings';
import { Icon } from './ui/Icon';
import { Shell } from './ui/Shell';

function History() {
  return (
    <section class="screen" aria-labelledby="history-title">
      <h1 id="history-title">History</h1>
      <div class="card" style={{ alignItems: 'center', textAlign: 'center', padding: '32px 20px' }}>
        <span class="hero-icon" style={{ background: 'var(--surface-2)', color: 'var(--muted)' }}>
          <Icon name="chartLine" />
        </span>
        <h2>Charts are coming</h2>
        <p class="muted">Your sessions are already saved. Charts, streaks and comfort trends arrive in the next update.</p>
      </div>
    </section>
  );
}

function Screen() {
  switch (route.value) {
    case 'home':
      return <Home />;
    case 'device':
      return <DeviceScreen />;
    case 'history':
      return <History />;
    case 'settings':
      return <Settings />;
    case 'setup':
      return <SessionSetup />;
    case 'live':
      return <LiveSession />;
    case 'done':
      return <SessionDone />;
  }
}

export function App() {
  return (
    <Shell>
      <Screen />
    </Shell>
  );
}
