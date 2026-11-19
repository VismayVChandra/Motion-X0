import { device } from '../device/instance';
import { hrefFor } from '../router';
import { runner } from '../session/instance';
import { PATTERNS } from '../session/patterns';
import { sessionStore, type SessionRecord } from '../store/sessions';
import { Icon } from '../ui/Icon';
import { duration, mmss, when } from '../ui/format';
import { ComfortChip } from '../ui/session-bits';

function greeting(now = new Date()) {
  const h = now.getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export function Home() {
  const inProgress = runner.inProgress.value;
  const connected = device.link.value === 'connected';
  const recent = sessionStore.sessions.value.slice(-4).reverse();
  const today = new Date().toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <section class="screen" aria-labelledby="home-title">
      <div class="stack">
        <span class="muted">{today}</span>
        <h1 id="home-title" style={{ fontSize: '30px' }}>
          {greeting()}
        </h1>
      </div>

      {inProgress ? (
        <section class="card" style={{ gap: '14px' }} aria-label="Session in progress">
          <div class="row-between">
            <p class="eyebrow">Session in progress</p>
            {runner.status.value === 'paused' ? (
              <span class="badge warn">
                <Icon name="pause" />
                Paused
              </span>
            ) : (
              <span class="badge ok">
                <span class="live-dot" style={{ width: '8px', height: '8px' }} />
                Running
              </span>
            )}
          </div>
          <p class="plan-big">{mmss(runner.remainingMs.value)} left</p>
          <a class="btn btn-primary btn-xl btn-block" href={hrefFor('live')}>
            <Icon name="timer" />
            Return to session
          </a>
        </section>
      ) : (
        <section class="card" style={{ gap: '14px' }} aria-label="Exercise">
          <p class="eyebrow">Guided exercise</p>
          <p class="lead">Gentle, motor-assisted leg exercise with exercise tracking.</p>
          <a class="btn btn-primary btn-xl btn-block" href={hrefFor('setup')}>
            <Icon name="play" />
            Start a session
          </a>
          {!connected && (
            <a class="link" href={hrefFor('device')}>
              <Icon name="wifiOff" size={18} />
              Not connected. Go to Device
              <Icon name="chevronRight" size={18} />
            </a>
          )}
        </section>
      )}

      <section class="stack" style={{ gap: '8px' }} aria-labelledby="recent-title">
        <h2 id="recent-title">Recent sessions</h2>
        {recent.length ? (
          <div class="list">
            {recent.map((s) => (
              <SessionRow key={s.id} s={s} />
            ))}
          </div>
        ) : (
          <div class="card muted" style={{ textAlign: 'center' }}>
            No sessions yet. Your sessions are saved here after each one.
          </div>
        )}
      </section>
    </section>
  );
}

export function SessionRow({ s }: { s: SessionRecord }) {
  const extra = s.endReason === 'estop' ? ' · emergency stop' : s.endReason === 'ended_early' ? ' · ended early' : '';
  return (
    <div class="list-item">
      <span class="li-ic">
        <Icon name="activity" />
      </span>
      <div class="stack">
        <strong>{when(s.startedAt)}</strong>
        <span>
          {duration(s.activeSec)} · Level {s.level} · {PATTERNS[s.pattern].label.split(' ')[0]}
          {extra}
        </span>
      </div>
      <ComfortChip score={s.comfort} />
    </div>
  );
}
