import { device } from '../device/instance';
import { t } from '../i18n';
import { hrefFor, navigate } from '../router';
import { runner, setupChoice } from '../session/instance';
import { PATTERN_IDS, type SpeedLevel } from '../session/patterns';
import { planStore } from '../store/plan';
import { Icon } from '../ui/Icon';
import { levelName, PatternIcon, patternDesc, patternLabel } from '../ui/session-bits';

export const DURATION_OPTIONS = [2, 5, 10, 15, 20] as const;

export function SessionSetup() {
  const choice = setupChoice.value;
  const plan = planStore.plan.value;
  const set = (patch: Partial<typeof choice>) => (setupChoice.value = { ...choice, ...patch });
  // Read signals so the screen updates as the connection changes.
  void device.link.value;
  void device.state.value;
  void runner.status.value;
  const block = runner.canStart();

  if (block === 'already_running') {
    return (
      <section class="screen">
        <h1>{t('setup.running')}</h1>
        <a class="btn btn-primary btn-xl btn-block" href={hrefFor('live')}>
          <Icon name="timer" />
          {t('home.return')}
        </a>
      </section>
    );
  }

  const start = () => {
    const ok = runner.start({ durationSec: choice.minutes * 60, level: choice.level, pattern: choice.pattern });
    if (ok) navigate('live');
  };
  const planText = plan ? t('setup.planIs', { level: plan.level, min: plan.durationMin }) : '';

  return (
    <section class="screen" aria-labelledby="setup-title">
      <div class="stack">
        <p class="eyebrow">{t('setup.eyebrow')}</p>
        <h1 id="setup-title">{t('setup.title')}</h1>
      </div>

      {plan &&
        (choice.level === plan.level && choice.minutes === plan.durationMin ? (
          <div class="card-tonal">
            <Icon name="clipboard" />
            <span>
              {planText} {t('setup.planSelected')}
            </span>
          </div>
        ) : (
          <div class="card-tonal" style={{ alignItems: 'center' }}>
            <Icon name="clipboard" />
            <span style={{ flex: 1 }}>{planText}</span>
            <button
              type="button"
              class="btn btn-tonal"
              style={{ minHeight: '48px', padding: '8px 14px', background: 'var(--surface)' }}
              onClick={() => set({ level: plan.level, minutes: plan.durationMin })}
            >
              {t('setup.usePlan')}
            </button>
          </div>
        ))}

      <fieldset>
        <legend>{t('setup.howLong')}</legend>
        <div class="chips" role="radiogroup" aria-label={t('setup.duration')}>
          {DURATION_OPTIONS.map((m) => (
            <button
              key={m}
              type="button"
              class="seg-btn"
              role="radio"
              aria-checked={choice.minutes === m}
              aria-label={t('setup.minutesAria', { n: m })}
              onClick={() => set({ minutes: m })}
            >
              <span class="seg-main">{m}</span>
              <span class="seg-sub">{t('unit.min')}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend>{t('device.speedLevel')}</legend>
        <div class="seg" role="radiogroup" aria-label={t('device.speedLevel')}>
          {([1, 2, 3] as SpeedLevel[]).map((l) => (
            <button
              key={l}
              type="button"
              class="seg-btn"
              role="radio"
              aria-checked={choice.level === l}
              aria-label={t('level.aria', { n: l, name: levelName(l) })}
              onClick={() => set({ level: l })}
            >
              <span class="seg-main">{l}</span>
              <span class="seg-sub">{levelName(l)}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend>{t('setup.pattern')}</legend>
        <div class="stack" style={{ gap: '8px' }} role="radiogroup" aria-label={t('setup.pattern')}>
          {PATTERN_IDS.map((p) => {
            const sel = choice.pattern === p;
            return (
              <button key={p} type="button" class="opt" role="radio" aria-checked={sel} onClick={() => set({ pattern: p })}>
                <PatternIcon pattern={p} />
                <span class="opt-text">
                  <strong>{patternLabel(p)}</strong>
                  <span>{patternDesc(p)}</span>
                </span>
                <span class="opt-check">{sel && <Icon name="check" />}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <p class="muted small" style={{ textAlign: 'center' }}>
        {t('setup.summary', { min: choice.minutes, level: choice.level, pattern: patternLabel(choice.pattern) })}
      </p>

      {block === 'not_connected' && (
        <div class="card-tonal">
          <Icon name="wifiOff" />
          <span>
            {t('setup.connectFirst')} <a href={hrefFor('device')}>{t('setup.goDevice')}</a>
          </span>
        </div>
      )}
      {block === 'estop' && (
        <div class="advisory" role="status">
          <Icon name="triangleAlert" />
          <div>
            <strong>{t('device.estopTitle')}</strong>
            <p>
              {t('setup.estopReset')} <a href={hrefFor('device')}>{t('setup.goDevice')}</a>
            </p>
          </div>
        </div>
      )}

      <button type="button" class="btn btn-primary btn-xl btn-block" disabled={block !== null} onClick={start}>
        <Icon name="play" />
        {t('setup.start')}
      </button>
    </section>
  );
}
