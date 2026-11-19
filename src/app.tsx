import { device } from './device/instance';
import { hrefFor, route } from './router';
import { DeviceScreen } from './screens/DeviceScreen';
import { Settings } from './screens/Settings';
import { Icon } from './ui/Icon';
import { Shell } from './ui/Shell';

function Home() {
  const connected = device.link.value === 'connected';
  return (
    <section class="screen" aria-labelledby="home-title">
      <div class="stack">
        <span class="muted">Welcome</span>
        <h1 id="home-title" style={{ fontSize: '30px' }}>
          MOTION-X
        </h1>
      </div>
      <section class="card" style={{ gap: '14px' }}>
        <p class="eyebrow">Guided exercise</p>
        <p class="lead">MOTION-X supports gentle, motor-assisted leg exercise with exercise tracking.</p>
        <a class="btn btn-primary btn-xl btn-block" href={hrefFor('device')}>
          <Icon name={connected ? 'gauge' : 'link'} />
          {connected ? 'Open device controls' : 'Connect to device'}
        </a>
      </section>
      <div class="card-tonal">
        <Icon name="info" />
        <span>Today’s plan and session tracking arrive in the next update.</span>
      </div>
    </section>
  );
}

function History() {
  return (
    <section class="screen" aria-labelledby="history-title">
      <h1 id="history-title">History</h1>
      <div class="card" style={{ alignItems: 'center', textAlign: 'center', padding: '32px 20px' }}>
        <span class="hero-icon" style={{ background: 'var(--surface-2)', color: 'var(--muted)' }}>
          <Icon name="chartLine" />
        </span>
        <h2>No sessions yet</h2>
        <p class="muted">Your charts, streak and comfort scores will show up here after your first session.</p>
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
  }
}

export function App() {
  return (
    <Shell>
      <Screen />
    </Shell>
  );
}
