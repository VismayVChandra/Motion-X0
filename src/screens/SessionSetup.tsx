import { device } from '../device/instance';
import { navigate, hrefFor } from '../router';
import { runner, setupChoice } from '../session/instance';
import { PATTERN_IDS, PATTERNS, type SpeedLevel } from '../session/patterns';
import { planStore } from '../store/plan';
import { Icon } from '../ui/Icon';
import { PatternIcon } from '../ui/session-bits';
import { LEVEL_NAMES } from './DeviceScreen';

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
        <h1>A session is running</h1>
        <a class="btn btn-primary btn-xl btn-block" href={hrefFor('live')}>
          <Icon name="timer" />
          Return to session
        </a>
      </section>
    );
  }

  const start = () => {
    const ok = runner.start({ durationSec: choice.minutes * 60, level: choice.level, pattern: choice.pattern });
    if (ok) navigate('live');
  };

  return (
    <section class="screen" aria-labelledby="setup-title">
      <div class="stack">
        <p class="eyebrow">New session</p>
        <h1 id="setup-title">Set up your session</h1>
      </div>

      {plan &&
        (choice.level === plan.level && choice.minutes === plan.durationMin ? (
          <div class="card-tonal">
            <Icon name="clipboard" />
            <span>
              Your therapist’s plan is{' '}
              <strong>
                Level {plan.level} · {plan.durationMin} min
              </strong>
              . It’s already selected.
            </span>
          </div>
        ) : (
          <div class="card-tonal" style={{ alignItems: 'center' }}>
            <Icon name="clipboard" />
            <span style={{ flex: 1 }}>
              Your therapist’s plan is{' '}
              <strong>
                Level {plan.level} · {plan.durationMin} min
              </strong>
              .
            </span>
            <button
              type="button"
              class="btn btn-tonal"
              style={{ minHeight: '44px', padding: '8px 14px', background: 'var(--surface)' }}
              onClick={() => set({ level: plan.level, minutes: plan.durationMin })}
            >
              Use plan
            </button>
          </div>
        ))}

      <fieldset>
        <legend>How long?</legend>
        <div class="chips" role="radiogroup" aria-label="Duration">
          {DURATION_OPTIONS.map((m) => (
            <button
              key={m}
              type="button"
              class="seg-btn"
              role="radio"
              aria-checked={choice.minutes === m}
              aria-label={`${m} minutes`}
              onClick={() => set({ minutes: m })}
            >
              <span class="seg-main">{m}</span>
              <span class="seg-sub">min</span>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend>Speed level</legend>
        <div class="seg" role="radiogroup" aria-label="Speed level">
          {([1, 2, 3] as SpeedLevel[]).map((l) => (
            <button
              key={l}
              type="button"
              class="seg-btn"
              role="radio"
              aria-checked={choice.level === l}
              aria-label={`Level ${l}, ${LEVEL_NAMES[l]}`}
              onClick={() => set({ level: l })}
            >
              <span class="seg-main">{l}</span>
              <span class="seg-sub">{LEVEL_NAMES[l]}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend>Pattern</legend>
        <div class="stack" style={{ gap: '8px' }} role="radiogroup" aria-label="Pattern">
          {PATTERN_IDS.map((p) => {
            const sel = choice.pattern === p;
            return (
              <button key={p} type="button" class="opt" role="radio" aria-checked={sel} onClick={() => set({ pattern: p })}>
                <PatternIcon pattern={p} />
                <span class="opt-text">
                  <strong>{PATTERNS[p].label}</strong>
                  <span>{PATTERNS[p].desc}</span>
                </span>
                <span class="opt-check">{sel && <Icon name="check" />}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <p class="muted small" style={{ textAlign: 'center' }}>
        {choice.minutes} min · Level {choice.level} · {PATTERNS[choice.pattern].label}
      </p>

      {block === 'not_connected' && (
        <div class="card-tonal">
          <Icon name="wifiOff" />
          <span>
            Connect to the device first. <a href={hrefFor('device')}>Go to Device</a>
          </span>
        </div>
      )}
      {block === 'estop' && (
        <div class="advisory" role="status">
          <Icon name="triangleAlert" />
          <div>
            <strong>Emergency stop is on</strong>
            <p>
              Reset it on the <a href={hrefFor('device')}>Device</a> screen before starting.
            </p>
          </div>
        </div>
      )}

      <button type="button" class="btn btn-primary btn-xl btn-block" disabled={block !== null} onClick={start}>
        <Icon name="play" />
        Start session
      </button>
    </section>
  );
}
