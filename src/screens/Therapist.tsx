import { useState } from 'preact/hooks';
import { t } from '../i18n';
import { addDays, averageComfort, comfortTrend, todayProgress, weeklyAdherence } from '../progress/stats';
import { hrefFor } from '../router';
import type { SpeedLevel } from '../session/patterns';
import { MAX_SESSIONS_PER_DAY, PLAN_DURATIONS, planStore, type Plan } from '../store/plan';
import { isHighComfortScore, sessionStore, type SessionRecord } from '../store/sessions';
import { settingsStore } from '../store/settings';
import { ComfortLineChart } from '../ui/charts';
import { Icon } from '../ui/Icon';
import { duration, shortDate, when } from '../ui/format';
import { ComfortChip, levelName } from '../ui/session-bits';

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('') || '?';

/** Therapist view (Home tab when the role is Therapist). */
export function TherapistDashboard() {
  const plan = planStore.plan.value;
  const sessions = sessionStore.sessions.value;

  return (
    <section class="screen" aria-labelledby="therapist-title">
      <h1 id="therapist-title" class="visually-hidden">
        {t('therapist.title')}
      </h1>
      <div class="desk-grid">
        <div class="desk-col">
          <div class="patient-head">
            <span class="avatar" aria-hidden="true">
              {plan ? initials(plan.patientName) : <Icon name="user" />}
            </span>
            <div class="stack" style={{ gap: 0, flex: 1, minWidth: 0 }}>
              <strong style={{ fontSize: '20px' }}>{plan?.patientName ?? t('therapist.noPatient')}</strong>
              <span class="muted small">
                {plan ? t('therapist.planSince', { date: shortDate(plan.startedAt) }) : t('therapist.createToStart')}
              </span>
            </div>
            <span class="badge neutral">
              <Icon name="stethoscope" />
              {t('role.therapist')}
            </span>
          </div>
          <PlanForm plan={plan} />
        </div>
        <div class="desk-col">
          {plan && <AdherenceCard plan={plan} sessions={sessions} />}
          <ComfortCard sessions={sessions} />
          <LatestSessions sessions={sessions} />
          <button type="button" class="btn btn-secondary btn-block" onClick={() => settingsStore.update({ role: 'patient' })}>
            <Icon name="arrowLeftRight" />
            {t('therapist.toPatient')}
          </button>
        </div>
      </div>
    </section>
  );
}

function PlanForm({ plan }: { plan: Plan | null }) {
  const [name, setName] = useState(plan?.patientName ?? '');
  const [level, setLevel] = useState<SpeedLevel>(plan?.level ?? 1);
  const [minutes, setMinutes] = useState<number>(plan?.durationMin ?? 10);
  const [perDay, setPerDay] = useState(plan?.sessionsPerDay ?? 2);
  const [note, setNote] = useState(plan?.note ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const touch = () => setSaved(false);

  const dirty =
    !plan ||
    name.trim() !== plan.patientName ||
    level !== plan.level ||
    minutes !== plan.durationMin ||
    perDay !== plan.sessionsPerDay ||
    note.trim() !== plan.note;

  const save = (e: Event) => {
    e.preventDefault();
    if (!name.trim()) {
      setError(t('therapist.nameError'));
      return;
    }
    setError(null);
    planStore.save({ patientName: name, level, durationMin: minutes, sessionsPerDay: perDay, note });
    setSaved(true);
  };

  const reset = () => {
    setName(plan?.patientName ?? '');
    setLevel(plan?.level ?? 1);
    setMinutes(plan?.durationMin ?? 10);
    setPerDay(plan?.sessionsPerDay ?? 2);
    setNote(plan?.note ?? '');
    setError(null);
  };

  return (
    <form class="card" aria-labelledby="plan-title" onSubmit={save} noValidate>
      <div class="row-between">
        <h2 id="plan-title">{plan ? t('therapist.plan') : t('therapist.createPlan')}</h2>
        {plan && (
          <span class="muted" style={{ fontSize: '14px' }}>
            {t('therapist.edited', { date: shortDate(plan.updatedAt) })}
          </span>
        )}
      </div>

      <div class="field">
        <label for="plan-name">{t('therapist.name')}</label>
        <input
          id="plan-name"
          class="input"
          value={name}
          maxLength={60}
          autoComplete="off"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'plan-name-err' : undefined}
          onInput={(e) => {
            setName(e.currentTarget.value);
            touch();
          }}
        />
        {error && (
          <span id="plan-name-err" class="field-error">
            {error}
          </span>
        )}
      </div>

      <fieldset>
        <legend style={{ fontSize: '16px', marginBottom: '6px' }}>{t('device.speedLevel')}</legend>
        <div class="seg" role="radiogroup" aria-label={t('device.speedLevel')}>
          {([1, 2, 3] as SpeedLevel[]).map((l) => (
            <button
              key={l}
              type="button"
              class="seg-btn"
              role="radio"
              aria-checked={level === l}
              aria-label={t('level.aria', { n: l, name: levelName(l) })}
              onClick={() => {
                setLevel(l);
                touch();
              }}
            >
              <span class="seg-main">{l}</span>
              <span class="seg-sub">{levelName(l)}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend style={{ fontSize: '16px', marginBottom: '6px' }}>{t('therapist.duration')}</legend>
        <div class="chips" role="radiogroup" aria-label={t('therapist.duration')}>
          {PLAN_DURATIONS.map((m) => (
            <button
              key={m}
              type="button"
              class="seg-btn"
              role="radio"
              aria-checked={minutes === m}
              aria-label={t('setup.minutesAria', { n: m })}
              onClick={() => {
                setMinutes(m);
                touch();
              }}
            >
              <span class="seg-main">{m}</span>
              <span class="seg-sub">{t('unit.min')}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <div class="field">
        <span id="perday-label" style={{ fontWeight: 650 }}>
          {t('therapist.perDay')}
        </span>
        <div class="stepper" role="group" aria-labelledby="perday-label">
          <button
            type="button"
            aria-label={t('therapist.fewer')}
            disabled={perDay <= 1}
            onClick={() => {
              setPerDay(perDay - 1);
              touch();
            }}
          >
            <Icon name="minus" />
          </button>
          <output aria-live="polite">
            {perDay}
            <small>{t('therapist.perDayUnit')}</small>
          </output>
          <button
            type="button"
            aria-label={t('therapist.more')}
            disabled={perDay >= MAX_SESSIONS_PER_DAY}
            onClick={() => {
              setPerDay(perDay + 1);
              touch();
            }}
          >
            <Icon name="plus" />
          </button>
        </div>
      </div>

      <div class="field">
        <label for="plan-note">
          {t('therapist.note')} <span class="muted">{t('common.optional')}</span>
        </label>
        <textarea
          id="plan-note"
          class="input"
          maxLength={300}
          placeholder={t('therapist.notePlaceholder')}
          value={note}
          onInput={(e) => {
            setNote(e.currentTarget.value);
            touch();
          }}
        />
      </div>

      {saved && !dirty ? (
        <p class="saved-msg" role="status">
          <Icon name="circleCheck" />
          {t('therapist.saved')}
        </p>
      ) : (
        <div class={plan ? 'form-actions' : ''}>
          {plan && (
            <button class="btn btn-secondary" type="button" disabled={!dirty} onClick={reset}>
              {t('therapist.undo')}
            </button>
          )}
          <button class={`btn btn-primary${plan ? '' : ' btn-block btn-lg'}`} type="submit" disabled={!dirty}>
            <Icon name="save" />
            {plan ? t('therapist.save') : t('therapist.create')}
          </button>
        </div>
      )}
    </form>
  );
}

function AdherenceCard({ plan, sessions }: { plan: Plan; sessions: SessionRecord[] }) {
  const [week] = weeklyAdherence(sessions, plan, 1);
  const today = todayProgress(sessions, plan);
  const since = addDays(Date.now(), -6);
  const avg = averageComfort(sessions, since);
  const highs = sessions.filter((s) => s.startedAt >= since && isHighComfortScore(s.comfort)).length;
  const pct = week.pct ?? 0;
  const status = pct >= 80 ? t('therapist.onTrack') : pct >= 50 ? t('therapist.someMissed') : t('therapist.needsAttention');

  return (
    <section class="card" aria-labelledby="adh-title">
      <div class="row-between">
        <h2 id="adh-title">{t('therapist.adherence')}</h2>
        <span class={`badge ${pct >= 80 ? 'ok' : 'warn'}`}>
          <Icon name={pct >= 80 ? 'trendingUp' : 'triangleAlert'} />
          {status}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap' }}>
        <span class="big-pct">{pct}%</span>
        <span class="muted">{t('therapist.doneOfPlanned', { done: week.done, planned: week.planned })}</span>
      </div>
      <div
        class="meter"
        role="meter"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={t('therapist.adherence')}
      >
        <div style={{ width: `${pct}%` }} />
      </div>
      <div class="mini-stats">
        <div class="mini-stat">
          <strong>
            {today.done}/{today.target}
          </strong>
          <span>{t('therapist.today')}</span>
        </div>
        <div class="mini-stat">
          <strong>{avg ?? '–'}</strong>
          <span>{t('therapist.avgComfort')}</span>
        </div>
        <div class={`mini-stat${highs ? ' warn' : ''}`} style={{ gridColumn: '1 / -1' }}>
          <strong>
            {highs > 0 && <Icon name="triangleAlert" />}
            {highs}
          </strong>
          <span>{t('therapist.highScores')}</span>
        </div>
      </div>
    </section>
  );
}

function ComfortCard({ sessions }: { sessions: SessionRecord[] }) {
  const points = comfortTrend(sessions, 10);
  return (
    <section class="card" aria-labelledby="ct-title">
      <div class="chart-head">
        <div>
          <h2 id="ct-title">{t('history.comfort')}</h2>
          <p>{t('therapist.comfortSub', { n: points.length || 10 })}</p>
        </div>
      </div>
      {points.length ? <ComfortLineChart points={points} /> : <p class="muted">{t('history.noScores')}</p>}
    </section>
  );
}

function LatestSessions({ sessions }: { sessions: SessionRecord[] }) {
  const latest = sessions.slice(-6).reverse();
  return (
    <section class="stack" style={{ gap: '8px' }} aria-labelledby="latest-title">
      <h2 id="latest-title">{t('therapist.latest')}</h2>
      {latest.length ? (
        <div class="list">
          {latest.map((s) => (
            <a class="list-item list-link" key={s.id} href={hrefFor('report', s.id)}>
              <div class="stack">
                <strong>{when(s.startedAt)}</strong>
                <span>
                  {duration(s.activeSec)} · {t('level.label', { n: s.level })} · {t('therapist.cycles', { n: s.cycles })}
                  {s.endReason === 'ended_early' ? ` · ${t('end.earlyShort')}` : s.endReason === 'estop' ? ` · ${t('end.estopShort')}` : ''}
                </span>
                {s.note && <span class="note-text">“{s.note}”</span>}
              </div>
              <ComfortChip score={s.comfort} />
            </a>
          ))}
        </div>
      ) : (
        <div class="card muted" style={{ textAlign: 'center' }}>
          {t('therapist.noSessions')}
        </div>
      )}
    </section>
  );
}
