import { device } from '../device/instance';
import { t, tn } from '../i18n';
import { streaks, todayProgress } from '../progress/stats';
import { hrefFor, navigate } from '../router';
import { runner, setupChoice } from '../session/instance';
import { planStore, type Plan } from '../store/plan';
import { sessionStore, type SessionRecord } from '../store/sessions';
import { settingsStore } from '../store/settings';
import { storageOk } from '../store/storageCheck';
import { Icon } from '../ui/Icon';
import { duration, longDate, mmss, when } from '../ui/format';
import { ComfortChip, levelName, patternShort } from '../ui/session-bits';

export function greetingKey(now = new Date()) {
  const h = now.getHours();
  return h < 12 ? 'home.morning' : h < 17 ? 'home.afternoon' : 'home.evening';
}

/** Open session setup with the plan's level and duration preselected. */
export function startFromPlan(plan: Plan) {
  setupChoice.value = { ...setupChoice.value, minutes: plan.durationMin, level: plan.level };
  navigate('setup');
}

export function Home() {
  const plan = planStore.plan.value;
  const sessions = sessionStore.sessions.value;
  const inProgress = runner.inProgress.value;
  const connected = device.link.value === 'connected';
  const recent = sessions.slice(-4).reverse();
  const firstName = plan?.patientName.split(/\s+/)[0];

  return (
    <section class="screen" aria-labelledby="home-title">
      <div class="stack">
        <span class="muted">{longDate(Date.now())}</span>
        <h1 id="home-title" style={{ fontSize: '30px' }}>
          {firstName ? t(`${greetingKey()}Name`, { name: firstName }) : t(greetingKey())}
        </h1>
      </div>

      <StorageWarning />

      {!settingsStore.settings.value.guideSeen && !inProgress && (
        <div class="card-tonal guide-card" role="note">
          <Icon name="info" />
          <span style={{ flex: 1 }}>
            <strong>{t('guide.cardTitle')}</strong> {t('guide.cardText')}
          </span>
          <div class="guide-card-actions">
            <a class="btn btn-tonal" href={hrefFor('guide')} style={{ background: 'var(--surface)' }}>
              {t('guide.open')}
            </a>
            <button
              type="button"
              class="icon-btn"
              aria-label={t('guide.dismiss')}
              onClick={() => settingsStore.update({ guideSeen: true })}
            >
              <Icon name="x" />
            </button>
          </div>
        </div>
      )}

      {inProgress ? (
        <InProgressCard />
      ) : plan ? (
        <PlanCard plan={plan} sessions={sessions} />
      ) : (
        <section class="card" style={{ gap: '14px' }} aria-label={t('home.exercise')}>
          <p class="eyebrow">{t('home.exercise')}</p>
          <p class="lead">{t('home.exerciseLead')}</p>
          <a class="btn btn-primary btn-xl btn-block" href={hrefFor('setup')}>
            <Icon name="play" />
            {t('home.start')}
          </a>
          <p class="muted small">{t('home.noPlan')}</p>
        </section>
      )}

      {!connected && !inProgress && (
        <a class="link" href={hrefFor('device')}>
          <Icon name="wifiOff" size={18} />
          {t('home.notConnected')}
          <Icon name="chevronRight" size={18} />
        </a>
      )}

      <section class="stack" style={{ gap: '8px' }} aria-labelledby="recent-title">
        <div class="row-between">
          <h2 id="recent-title">{t('home.recent')}</h2>
          {sessions.length > 0 && (
            <a class="link" href={hrefFor('history')}>
              {t('home.seeAll')}
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
            {t('home.noSessions')}
          </div>
        )}
      </section>

      <button type="button" class="btn btn-ghost btn-block" onClick={() => settingsStore.update({ role: 'therapist' })}>
        <Icon name="stethoscope" />
        {t('home.therapistView')}
      </button>
    </section>
  );
}

/** Shown when the browser will not save data (private mode, storage blocked). */
export function StorageWarning() {
  if (storageOk) return null;
  return (
    <div class="advisory" role="alert">
      <Icon name="triangleAlert" />
      <div>
        <strong>{t('storage.title')}</strong>
        <p>{t('storage.text')}</p>
      </div>
    </div>
  );
}

function InProgressCard() {
  return (
    <section class="card" style={{ gap: '14px' }} aria-label={t('home.inProgress')}>
      <div class="row-between">
        <p class="eyebrow">{t('home.inProgress')}</p>
        {runner.status.value === 'paused' ? (
          <span class="badge warn">
            <Icon name="pause" />
            {t('live.paused')}
          </span>
        ) : (
          <span class="badge ok">
            <span class="live-dot" style={{ width: '8px', height: '8px' }} />
            {t('home.running')}
          </span>
        )}
      </div>
      <p class="plan-big">{t('home.left', { time: mmss(runner.remainingMs.value) })}</p>
      <a class="btn btn-primary btn-xl btn-block" href={hrefFor('live')}>
        <Icon name="timer" />
        {t('home.return')}
      </a>
    </section>
  );
}

function PlanCard({ plan, sessions }: { plan: Plan; sessions: SessionRecord[] }) {
  const p = todayProgress(sessions, plan);
  const { current } = streaks(sessions, plan);
  const segs = Array.from({ length: plan.sessionsPerDay }, (_, i) => i < p.done);

  return (
    <section class="card" style={{ gap: '14px' }} aria-labelledby="plan-eyebrow">
      <div class="row-between">
        <p class="eyebrow" id="plan-eyebrow">
          {t('home.todaysPlan')}
        </p>
        {current > 0 && (
          <span class="badge streak">
            <Icon name="flame" />
            {tn('home.streak', current)}
          </span>
        )}
      </div>
      <p class="plan-big">
        {p.complete ? t('home.allDone') : tn('home.doneOf', p.target, { done: Math.min(p.done, p.target) })}
      </p>
      <div class="progress-segs" aria-hidden="true">
        {segs.map((done, i) => (
          <div key={i} class={`pseg${done ? ' done' : ''}`}>
            {done ? (
              <>
                <Icon name="check" />
                {t('home.segDone')}
              </>
            ) : i === p.done ? (
              t('home.segNext')
            ) : (
              ''
            )}
          </div>
        ))}
      </div>
      <div class="plan-meta">
        <span>
          <Icon name="gauge" />
          {t('level.label', { n: plan.level })} · {levelName(plan.level)}
        </span>
        <span>
          <Icon name="timer" />
          {t('home.minEach', { n: plan.durationMin })}
        </span>
      </div>
      {plan.note && (
        <div class="card-tonal">
          <Icon name="clipboard" />
          <span>
            <strong>{t('home.fromTherapist')}</strong> {plan.note}
          </span>
        </div>
      )}
      {p.complete ? (
        <>
          <div class="done-head">
            <Icon name="circleCheck" />
            <span>{t('home.completeMsg')}</span>
          </div>
          <button type="button" class="btn btn-secondary btn-lg btn-block" onClick={() => startFromPlan(plan)}>
            <Icon name="play" />
            {t('home.extra')}
          </button>
        </>
      ) : (
        <button type="button" class="btn btn-primary btn-xl btn-block" onClick={() => startFromPlan(plan)}>
          <Icon name="play" />
          {t('home.startNext')}
        </button>
      )}
    </section>
  );
}

/** One saved session; tapping it opens the printable report. */
export function SessionRow({ s }: { s: SessionRecord }) {
  const extra = s.endReason === 'estop' ? ` · ${t('end.estopShort')}` : s.endReason === 'ended_early' ? ` · ${t('end.earlyShort')}` : '';
  return (
    <a class="list-item list-link" href={hrefFor('report', s.id)} aria-label={`${when(s.startedAt)}. ${t('report.open')}`}>
      <span class="li-ic">
        <Icon name="activity" />
      </span>
      <div class="stack">
        <strong>{when(s.startedAt)}</strong>
        <span>
          {duration(s.activeSec)} · {t('level.label', { n: s.level })} · {patternShort(s.pattern)}
          {extra}
        </span>
      </div>
      <ComfortChip score={s.comfort} />
    </a>
  );
}
