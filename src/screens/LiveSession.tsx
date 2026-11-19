import { device } from '../device/instance';
import { hrefFor } from '../router';
import { runner } from '../session/instance';
import { PATTERNS, type Phase } from '../session/patterns';
import { Icon } from '../ui/Icon';
import { duration, mmss } from '../ui/format';
import { LEVEL_NAMES } from './DeviceScreen';

const R = 108;
const C = 2 * Math.PI * R;

export function LiveSession() {
  const status = runner.status.value;
  const cfg = runner.config.value;

  if (!cfg || (status !== 'running' && status !== 'paused')) {
    return (
      <section class="screen">
        <h1>No session running</h1>
        <p class="lead">Set up a session to get started.</p>
        <a class="btn btn-primary btn-xl btn-block" href={hrefFor('setup')}>
          <Icon name="play" />
          Set up a session
        </a>
      </section>
    );
  }

  const remaining = runner.remainingMs.value;
  const progress = runner.progress.value;
  const phase = runner.phase.value?.phase;
  const st = device.state.value;
  const paused = status === 'paused';
  const reason = runner.pauseReason.value;
  const linkOk = device.link.value === 'connected';
  const minsLeft = Math.floor(Math.ceil(remaining / 1000) / 60);
  const secsLeft = Math.ceil(remaining / 1000) % 60;

  return (
    <section class="screen" aria-labelledby="live-title">
      <h1 id="live-title" class="visually-hidden">
        Live session
      </h1>
      <div class="row-between">
        {paused ? (
          <span class="badge warn">
            <Icon name="pause" />
            Paused
          </span>
        ) : (
          <span class="badge ok">
            <span class="live-dot" style={{ width: '8px', height: '8px' }} />
            Session running
          </span>
        )}
        <span class="muted small">{PATTERNS[cfg.pattern].label}</span>
      </div>

      {paused && reason === 'connection' && (
        <div class="alarm" role="alert">
          <div class="alarm-top">
            <span class="alarm-ic">
              <Icon name="octagonAlert" />
            </span>
            <div class="stack" style={{ gap: '6px' }}>
              <h2>Connection lost: motor stopped</h2>
              <p>Your session is paused and the time so far is kept. {linkOk ? 'Connection is back.' : 'Reconnecting…'}</p>
            </div>
          </div>
          {!linkOk && (
            <a class="btn btn-secondary btn-block" href={hrefFor('device')}>
              <Icon name="wifi" />
              Check connection
            </a>
          )}
        </div>
      )}
      {paused && reason === 'device_stopped' && (
        <div class="advisory" role="status">
          <Icon name="triangleAlert" />
          <div>
            <strong>The motor was stopped at the machine</strong>
            <p>Your session is paused. Resume when you are ready.</p>
          </div>
        </div>
      )}

      <div
        class={`ring-wrap${paused ? ' paused' : ''}`}
        role="timer"
        aria-live="off"
        aria-label={`${minsLeft} minutes ${secsLeft} seconds left of ${duration(cfg.durationSec)}`}
      >
        <svg viewBox="0 0 248 248" aria-hidden="true">
          <circle class="ring-track" cx="124" cy="124" r={R} fill="none" stroke-width="18" />
          <circle
            class="ring-prog"
            cx="124"
            cy="124"
            r={R}
            fill="none"
            stroke-width="18"
            stroke-dasharray={C}
            stroke-dashoffset={C * (1 - progress)}
          />
        </svg>
        <div class="ring-center">
          <span class="ring-time">{mmss(remaining)}</span>
          <span class="ring-sub">left of {mmss(cfg.durationSec * 1000)}</span>
          {phase && (
            <span class="badge neutral ring-phase">
              <Icon name="activity" />
              {phase.name}
            </span>
          )}
        </div>
      </div>

      <div class="stats">
        <div class="stat">
          <span class="stat-label">Speed level</span>
          <span class="stat-value">{st?.level ?? 0}</span>
          <span class="stat-unit">
            {st && st.level !== st.targetLevel
              ? `→ ${st.targetLevel}`
              : st && st.level > 0
                ? LEVEL_NAMES[st.level as 1 | 2 | 3]
                : 'stopped'}
          </span>
        </div>
        <div class="stat">
          <span class="stat-label">Pedal speed</span>
          <span class="stat-value">{st?.rpm == null ? '–' : Math.round(st.rpm)}</span>
          <span class="stat-unit">{st?.rpm == null ? 'estimated' : 'rpm'}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Cycles</span>
          <span class="stat-value">{Math.floor(runner.cycles.value)}</span>
          <span class="stat-unit">so far</span>
        </div>
      </div>

      <Timeline schedule={runner.schedule.value} progress={progress} planned={cfg.durationSec} />

      {paused ? (
        <button
          type="button"
          class="btn btn-primary btn-lg btn-block"
          disabled={!linkOk || st?.fault === 'estop'}
          onClick={() => runner.resume()}
        >
          <Icon name="play" />
          Resume
        </button>
      ) : (
        <button type="button" class="btn btn-secondary btn-lg btn-block" onClick={() => runner.pause()}>
          <Icon name="pause" />
          Pause
        </button>
      )}
      <button type="button" class="btn btn-ghost btn-block" onClick={() => runner.end()}>
        <Icon name="flag" />
        End session now
      </button>
    </section>
  );
}

function Timeline({ schedule, progress, planned }: { schedule: Phase[]; progress: number; planned: number }) {
  const t = progress * planned;
  const showLabels = schedule.length <= 3;
  return (
    <section class="card" aria-label="Pattern timeline">
      <div class="timeline" aria-hidden="true">
        {schedule.map((p) => {
          const len = p.end - p.start;
          const cls = t >= p.end ? 'done' : t >= p.start ? 'now' : '';
          const pct = cls === 'now' ? Math.round(((t - p.start) / len) * 100) : 0;
          return (
            <div
              key={p.start}
              class={`tl-seg ${cls} lvl-${p.level}`}
              style={{ flex: len, ...(cls === 'now' ? { '--p': `${pct}%` } : {}) }}
            />
          );
        })}
        <span class="tl-marker" style={{ left: `${Math.min(100, progress * 100)}%` }}>
          You
        </span>
      </div>
      {showLabels ? (
        <div class="tl-labels">
          {schedule.map((p) => (
            <span key={p.start} style={{ flex: p.end - p.start }}>
              <strong>{p.name}</strong>
              {duration(p.end - p.start)} · level {p.level}
            </span>
          ))}
        </div>
      ) : (
        <p class="muted small">
          Busy spells at level {Math.max(...schedule.map((p) => p.level))} and rest at level 1, every{' '}
          {duration(schedule[0].end - schedule[0].start)}.
        </p>
      )}
    </section>
  );
}
