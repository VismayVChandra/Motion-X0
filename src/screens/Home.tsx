import { device } from '../device/instance';
import { streaks, todayProgress } from '../progress/stats';
import { hrefFor, navigate } from '../router';
import { runner, setupChoice } from '../session/instance';
import { PATTERNS } from '../session/patterns';
import { planStore, type Plan } from '../store/plan';
import { sessionStore, type SessionRecord } from '../store/sessions';
import { settingsStore } from '../store/settings';
import { Icon } from '../ui/Icon';
import { duration, mmss, when } from '../ui/format';
import { ComfortChip } from '../ui/session-bits';
import { LEVEL_NAMES } from './DeviceScreen';

function greeting(now = new Date()) {
  const h = now.getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

/** Open session setup with the plan's level and duration preselected. */
function startFromPlan(plan: Plan) {
  setupChoice.value = { ...setupChoice.value, minutes: plan.durationMin, level: plan.level };
  navigate('setup');
}

export function Home() {
  const plan = planStore.plan.value;
  const sessions = sessionStore.sessions.value;
  const inProgress = runner.inProgress.value;
  const connected = device.link.value === 'connected';
  const recent = sessions.slice(-4).reverse();
  const today = new Date().toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });
  const firstName = plan?.patientName.split(/\s+/)[0];

  return (
    <section class="screen" aria-labelledby="home-title">
      <div class="stack">
        <span class="muted">{today}</span>
        <h1 id="home-title" style={{ fontSize: '30px' }}>
          {greeting()}
          {firstName ? `, ${firstName}` : ''}
        </h1>
      </div>

      {inProgress ? (
        <InProgressCard />
      ) : plan ? (
        <PlanCard plan={plan} sessions={sessions} />
      ) : (
        <section class="card" style={{ gap: '14px' }} aria-label="Exercise">
          <p class="eyebrow">Guided exercise</p>
          <p class="lead">Gentle, motor-assisted leg exercise with exercise tracking.</p>
          <a class="btn btn-primary btn-xl btn-block" href={hrefFor('setup')}>
            <Icon name="play" />
            Start a session
          </a>
          <p class="muted small">No plan yet. Your therapist can set one in the therapist view.</p>
        </section>
      )}

      {!connected && !inProgress && (
        <a class="link" href={hrefFor('device')}>
          <Icon name="wifiOff" size={18} />
          Not connected. Go to Device
          <Icon name="chevronRight" size={18} />
        </a>
      )}

      <section class="stack" style={{ gap: '8px' }} aria-labelledby="recent-title">
        <div class="row-between">
          <h2 id="recent-title">Recent sessions</h2>
          {sessions.length > 0 && (
            <a class="link" href={hrefFor('history')}>
              See all
              <Icon name="chevronRight" size={18} />
            </a>
          )}
        </div>
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

      <button type="button" class="btn btn-ghost btn-block" onClick={() => settingsStore.update({ role: 'therapist' })}>
        <Icon name="stethoscope" />
        Therapist view
      </button>
    </section>
  );
}

function InProgressCard() {
  return (
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
  );
}

function PlanCard({ plan, sessions }: { plan: Plan; sessions: SessionRecord[] }) {
  const t = todayProgress(sessions, plan);
  const { current } = streaks(sessions, plan);
  const segs = Array.from({ length: plan.sessionsPerDay }, (_, i) => i < t.done);

  return (
    <section class="card" style={{ gap: '14px' }} aria-labelledby="plan-eyebrow">
      <div class="row-between">
        <p class="eyebrow" id="plan-eyebrow">
          Today’s plan
        </p>
        {current > 0 && (
          <span class="badge streak">
            <Icon name="flame" />
            {current}-day streak
          </span>
        )}
      </div>
      <p class="plan-big">
        {t.complete ? 'All done for today' : `${Math.min(t.done, t.target)} of ${t.target} session${t.target > 1 ? 's' : ''} done`}
      </p>
      <div class="progress-segs" aria-hidden="true">
        {segs.map((done, i) => (
          <div key={i} class={`pseg${done ? ' done' : ''}`}>
            {done ? (
              <>
                <Icon name="check" />
                Done
              </>
            ) : i === t.done ? (
              'Next'
            ) : (
              ''
            )}
          </div>
        ))}
      </div>
      <div class="plan-meta">
        <span>
          <Icon name="gauge" />
          Level {plan.level} · {LEVEL_NAMES[plan.level]}
        </span>
        <span>
          <Icon name="timer" />
          {plan.durationMin} min each
        </span>
      </div>
      {plan.note && (
        <div class="card-tonal">
          <Icon name="clipboard" />
          <span>
            <strong>From your therapist:</strong> {plan.note}
          </span>
        </div>
      )}
      {t.complete ? (
        <>
          <div class="done-head">
            <Icon name="circleCheck" />
            <span>Today’s plan is complete. Well done.</span>
          </div>
          <button type="button" class="btn btn-secondary btn-lg btn-block" onClick={() => startFromPlan(plan)}>
            <Icon name="play" />
            Extra session
          </button>
        </>
      ) : (
        <button type="button" class="btn btn-primary btn-xl btn-block" onClick={() => startFromPlan(plan)}>
          <Icon name="play" />
          Start next session
        </button>
      )}
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
