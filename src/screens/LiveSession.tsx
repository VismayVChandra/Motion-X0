import { device } from '../device/instance';
import { t } from '../i18n';
import { hrefFor } from '../router';
import { runner } from '../session/instance';
import type { Phase } from '../session/patterns';
import { Icon } from '../ui/Icon';
import { duration, mmss } from '../ui/format';
import { levelName, patternLabel, phaseName } from '../ui/session-bits';

const R = 108;
const C = 2 * Math.PI * R;

/** The countdown ring, shared with Simple mode. */
export function ProgressRing({ big }: { big?: boolean }) {
  const cfg = runner.config.value;
  const remaining = runner.remainingMs.value;
  const progress = runner.progress.value;
  const phase = runner.phase.value?.phase;
  const paused = runner.status.value === 'paused';
  if (!cfg) return null;
  const left = Math.ceil(remaining / 1000);
  return (
    <div
      class={`ring-wrap${paused ? ' paused' : ''}${big ? ' big' : ''}`}
      role="timer"
      aria-live="off"
      aria-label={t('live.timerAria', { m: Math.floor(left / 60), s: left % 60, total: duration(cfg.durationSec) })}
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
        <span class="ring-sub">{t('live.leftOf', { total: mmss(cfg.durationSec * 1000) })}</span>
        {phase && (
          <span class="badge neutral ring-phase">
            <Icon name="activity" />
            {phaseName(phase.name)}
          </span>
        )}
      </div>
    </div>
  );
}

/** Banner shown while a session is paused for a reason other than the user. Shared with Simple mode. */
export function PauseBanner() {
  const reason = runner.pauseReason.value;
  const linkOk = device.link.value === 'connected';
  if (runner.status.value !== 'paused') return null;
  if (reason === 'connection')
    return (
      <div class="alarm" role="alert">
        <div class="alarm-top">
          <span class="alarm-ic">
            <Icon name="octagonAlert" />
          </span>
          <div class="stack" style={{ gap: '6px' }}>
            <h2>{t('lost.title')}</h2>
            <p>
              {t('live.pausedKept')} {linkOk ? t('live.linkBack') : t('live.reconnecting')}
            </p>
          </div>
        </div>
        {!linkOk && (
          <a class="btn btn-secondary btn-block" href={hrefFor('device')}>
            <Icon name="wifi" />
            {t('live.checkConnection')}
          </a>
        )}
      </div>
    );
  if (reason === 'device_stopped')
    return (
      <div class="advisory" role="status">
        <Icon name="triangleAlert" />
        <div>
          <strong>{t('live.stoppedAtMachine')}</strong>
          <p>{t('live.resumeWhenReady')}</p>
        </div>
      </div>
    );
  return null;
}

export function LiveSession() {
  const status = runner.status.value;
  const cfg = runner.config.value;

  if (!cfg || (status !== 'running' && status !== 'paused')) {
    return (
      <section class="screen">
        <h1>{t('live.none')}</h1>
        <p class="lead">{t('live.noneLead')}</p>
        <a class="btn btn-primary btn-xl btn-block" href={hrefFor('setup')}>
          <Icon name="play" />
          {t('live.setUp')}
        </a>
      </section>
    );
  }

  const st = device.state.value;
  const paused = status === 'paused';
  const linkOk = device.link.value === 'connected';

  return (
    <section class="screen" aria-labelledby="live-title">
      <h1 id="live-title" class="visually-hidden">
        {t('live.title')}
      </h1>
      <div class="row-between">
        {paused ? (
          <span class="badge warn">
            <Icon name="pause" />
            {t('live.paused')}
          </span>
        ) : (
          <span class="badge ok">
            <span class="live-dot" style={{ width: '8px', height: '8px' }} />
            {t('live.running')}
          </span>
        )}
        <span class="muted small">{patternLabel(cfg.pattern)}</span>
      </div>

      <PauseBanner />
      <ProgressRing />

      <div class="stats">
        <div class="stat">
          <span class="stat-label">{t('device.speedLevel')}</span>
          <span class="stat-value">{st?.level ?? 0}</span>
          <span class="stat-unit">
            {st && st.level !== st.targetLevel ? `→ ${st.targetLevel}` : levelName(st?.level ?? 0)}
          </span>
        </div>
        <div class="stat">
          <span class="stat-label">{t('device.pedalSpeed')}</span>
          <span class="stat-value">{st?.rpm == null ? '–' : Math.round(st.rpm)}</span>
          <span class="stat-unit">{st?.rpm == null ? t('live.estimated') : t('unit.rpm')}</span>
        </div>
        <div class="stat">
          <span class="stat-label">{t('live.cycles')}</span>
          <span class="stat-value">{Math.floor(runner.cycles.value)}</span>
          <span class="stat-unit">{t('live.soFar')}</span>
        </div>
      </div>

      <Timeline schedule={runner.schedule.value} progress={runner.progress.value} planned={cfg.durationSec} />

      {paused ? (
        <button
          type="button"
          class="btn btn-primary btn-lg btn-block"
          disabled={!linkOk || st?.fault === 'estop'}
          onClick={() => runner.resume()}
        >
          <Icon name="play" />
          {t('live.resume')}
        </button>
      ) : (
        <button type="button" class="btn btn-secondary btn-lg btn-block" onClick={() => runner.pause()}>
          <Icon name="pause" />
          {t('live.pause')}
        </button>
      )}
      <button type="button" class="btn btn-ghost btn-block" onClick={() => runner.end()}>
        <Icon name="flag" />
        {t('live.endNow')}
      </button>
    </section>
  );
}

function Timeline({ schedule, progress, planned }: { schedule: Phase[]; progress: number; planned: number }) {
  const tNow = progress * planned;
  const showLabels = schedule.length <= 3;
  return (
    <section class="card" aria-label={t('live.timeline')}>
      <div class="timeline" aria-hidden="true">
        {schedule.map((p) => {
          const len = p.end - p.start;
          const cls = tNow >= p.end ? 'done' : tNow >= p.start ? 'now' : '';
          const pct = cls === 'now' ? Math.round(((tNow - p.start) / len) * 100) : 0;
          return (
            <div
              key={p.start}
              class={`tl-seg ${cls} lvl-${p.level}`}
              style={{ flex: len, ...(cls === 'now' ? { '--p': `${pct}%` } : {}) }}
            />
          );
        })}
        <span class="tl-marker" style={{ left: `${Math.min(100, progress * 100)}%` }}>
          {t('live.you')}
        </span>
      </div>
      {showLabels ? (
        <div class="tl-labels">
          {schedule.map((p) => (
            <span key={p.start} style={{ flex: p.end - p.start }}>
              <strong>{phaseName(p.name)}</strong>
              {duration(p.end - p.start)} · {t('level.short', { n: p.level })}
            </span>
          ))}
        </div>
      ) : (
        <p class="muted small">
          {t('live.intervalsInfo', {
            level: Math.max(...schedule.map((p) => p.level)),
            every: duration(schedule[0].end - schedule[0].start),
          })}
        </p>
      )}
    </section>
  );
}
