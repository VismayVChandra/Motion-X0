import { signal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { device, now } from '../device/instance';
import { NOMINAL_RPM } from '../device/protocol';
import type { DeviceState, Level } from '../device/types';
import { t } from '../i18n';
import { settingsStore } from '../store/settings';
import { Icon } from '../ui/Icon';
import { Switch } from '../ui/controls';
import { levelName } from '../ui/session-bits';
import { isNotReadyFault } from '../session/runner';

const SPEEDS: (1 | 2 | 3)[] = [1, 2, 3];
/** Level picked while stopped; kept across reconnects and screen changes. */
const chosenLevel = signal<1 | 2 | 3>(1);

/** Device tab: picks Connect, Connection lost, or Control based on the link state. */
export function DeviceScreen() {
  const link = device.link.value;
  if (link === 'lost') return <LostView />;
  if (link === 'connected' && device.state.value) return <ControlView state={device.state.value} />;
  return <ConnectView />;
}

/** Seconds until the next automatic reconnect, or null. */
function retryIn(): number | null {
  const at = device.nextRetryAt.value;
  return at ? Math.max(0, Math.ceil((at - now.value) / 1000)) : null;
}

// ---------------------------------------------------------------- Connect

function ConnectView() {
  const link = device.link.value;
  const demo = settingsStore.settings.value.demoMode;
  const searching = link === 'connecting';
  const wait = retryIn();
  const err = device.error.value;

  return (
    <section class="screen" aria-labelledby="connect-title">
      <div class="hero-icon">
        <Icon name={demo ? 'flask' : 'wifi'} />
      </div>
      <div class="stack" style={{ gap: '8px' }}>
        <h1 id="connect-title">{demo ? t('connect.demoTitle') : t('connect.title')}</h1>
        <p class="lead">{demo ? t('connect.demoLead') : t('connect.lead')}</p>
      </div>

      {!demo && (
        <ol class="steps card">
          <li>
            <span class="step-n">1</span>
            <strong>{t('connect.step1')}</strong>
          </li>
          <li>
            <span class="step-n">2</span>
            <div class="stack">
              <strong>{t('connect.step2')}</strong>
              <span class="muted small">{t('connect.step2hint')}</span>
            </div>
          </li>
          <li>
            <span class="step-n">3</span>
            <strong>{t('connect.step3')}</strong>
          </li>
        </ol>
      )}

      {searching && (
        <div class="card status-card" role="status">
          <span class="spin-ic spin">
            <Icon name="loader" />
          </span>
          <div class="stack">
            <strong>{demo ? t('connect.startingDemo') : t('connect.looking')}</strong>
            <span class="muted small">
              {device.attempt.value > 0
                ? wait !== null
                  ? t('connect.autoRetryIn', { s: wait })
                  : t('connect.autoRetry')
                : t('connect.moment')}
            </span>
          </div>
        </div>
      )}

      {err && err !== 'cancelled' && searching && (
        <p class="field-error" role="alert">
          {t(`connect.error.${err}`)}
        </p>
      )}

      {searching ? (
        <div class="btn-pair">
          <button type="button" class="btn btn-primary btn-lg" onClick={() => device.retryNow()}>
            <Icon name="rotateCw" />
            {t('common.tryNow')}
          </button>
          <button type="button" class="btn btn-secondary btn-lg" onClick={() => device.disconnect()}>
            {t('common.cancel')}
          </button>
        </div>
      ) : (
        <button type="button" class="btn btn-primary btn-lg btn-block" onClick={() => void device.connect()}>
          <Icon name="link" />
          {demo ? t('connect.startDemo') : t('connect.connect')}
        </button>
      )}

      <div class="divider">{t('common.or')}</div>
      {demo ? (
        <button type="button" class="btn btn-secondary btn-lg btn-block" onClick={() => switchMode(false)}>
          <Icon name="wifi" />
          {t('connect.useReal')}
        </button>
      ) : (
        <button type="button" class="btn btn-secondary btn-lg btn-block" onClick={() => switchMode(true)}>
          <Icon name="flask" />
          {t('connect.useDemo')} <span class="btn-sub">{t('connect.useDemoSub')}</span>
        </button>
      )}
    </section>
  );
}

/** Switch Demo mode and make sure we end up connecting. */
export function switchMode(demo: boolean) {
  settingsStore.update({ demoMode: demo }); // instance effect reconfigures if already connecting
  void device.connect();
}

// ---------------------------------------------------------------- Control

function ControlView({ state }: { state: DeviceState }) {
  const chosen = chosenLevel.value;
  const active = state.running || state.targetLevel > 0;
  const estop = state.fault === 'estop';
  const timedOut = state.fault === 'heartbeat_timeout';
  const notReady = isNotReadyFault(state.fault);
  const target: Level = active ? state.targetLevel : chosen;
  const ramping = active && state.level !== state.targetLevel;
  const demo = device.kind.value === 'sim';

  const pickLevel = (l: 1 | 2 | 3) => {
    chosenLevel.value = l;
    if (active) device.setLevel(l);
  };

  return (
    <section class="screen" aria-labelledby="device-title">
      <div class="row-between">
        <h1 id="device-title">{t('device.title')}</h1>
        <MotorBadge state={state} />
      </div>

      {estop && <EstopAlarm running={state.running} />}
      {notReady && <NotReadyNotice fault={state.fault} />}

      {timedOut && !active && (
        <div class="advisory" role="status">
          <Icon name="triangleAlert" />
          <div>
            <strong>{t('device.timeoutTitle')}</strong>
            <p>{t('device.timeoutText')}</p>
          </div>
        </div>
      )}

      <div class="btn-pair">
        <button
          type="button"
          class="btn btn-primary btn-lg"
          aria-disabled={active || estop || notReady}
          disabled={estop || notReady}
          onClick={() => !active && device.start(chosen)}
        >
          <Icon name={active ? 'check' : 'play'} />
          {active ? t('device.running') : t('device.start')}
        </button>
        <button type="button" class="btn btn-secondary btn-lg" disabled={!active} onClick={() => device.stop()}>
          <Icon name="square" />
          {t('device.stopMotor')}
        </button>
      </div>

      <section class="card" aria-labelledby="speed-title">
        <h2 id="speed-title">{t('device.speedLevel')}</h2>
        <div class="seg" role="radiogroup" aria-label={t('device.speedLevel')} style={{ paddingTop: '8px' }}>
          {SPEEDS.map((l) => {
            const selected = l === target;
            const isNow = ramping && state.level === l && !selected;
            const tag = selected && ramping ? t('device.target') : isNow ? t('device.now') : '';
            return (
              <button
                key={l}
                type="button"
                class={`seg-btn${isNow ? ' is-current' : ''}`}
                role="radio"
                aria-checked={selected}
                aria-label={t('level.aria', { n: l, name: levelName(l) }) + (tag ? `, ${tag}` : '')}
                disabled={estop || notReady}
                onClick={() => pickLevel(l)}
              >
                {tag && <span class="seg-tag">{tag}</span>}
                <span class="seg-main">{l}</span>
                <span class="seg-sub">{levelName(l)}</span>
              </button>
            );
          })}
        </div>
        {ramping && <RampRow state={state} />}
        {!active && !estop && !notReady && <p class="muted small">{t('device.pickHint')}</p>}
      </section>

      <section class="stack" style={{ gap: '10px' }} aria-labelledby="live-title">
        <div class="row-between">
          <h2 id="live-title">{t('device.readouts')}</h2>
          <span class="live-label">
            <span class="live-dot" />
            {t('device.live')}
          </span>
        </div>
        <Readouts state={state} />
      </section>

      {demo && <DemoTools />}

      <button type="button" class="btn btn-ghost btn-block" onClick={() => device.disconnect()}>
        <Icon name="unplug" />
        {t('device.disconnect')}
      </button>
    </section>
  );
}

/** The machine is starting up (ESC arming) or reports another blocking fault. */
export function NotReadyNotice({ fault }: { fault: string | null }) {
  return (
    <div class="card status-card" role="status">
      <span class="spin-ic spin">
        <Icon name="loader" />
      </span>
      <div class="stack">
        <strong>{t('device.readyTitle')}</strong>
        <span class="muted small">
          {fault === 'esc_not_armed' ? t('device.readyText') : t('device.faultText', { code: String(fault) })}
        </span>
      </div>
    </div>
  );
}

/** Shown while the e-stop latch is set. Also used by Simple mode. */
export function EstopAlarm({ running }: { running: boolean }) {
  return (
    <div class="alarm" role="alert">
      <div class="alarm-top">
        <span class="alarm-ic">
          <Icon name="octagonX" />
        </span>
        <div class="stack" style={{ gap: '6px' }}>
          <h2>{t('device.estopTitle')}</h2>
          <p>{t('device.estopText')}</p>
        </div>
      </div>
      <button type="button" class="btn btn-secondary btn-lg btn-block" disabled={running} onClick={() => device.reset()}>
        <Icon name="rotateCcw" />
        {t('device.estopReset')}
      </button>
    </div>
  );
}

function MotorBadge({ state }: { state: DeviceState }) {
  if (state.fault === 'estop')
    return (
      <span class="badge danger">
        <Icon name="octagonX" />
        {t('device.badgeEstop')}
      </span>
    );
  if (state.running && state.level < state.targetLevel)
    return (
      <span class="badge ok">
        <Icon name="trendingUp" />
        {t('device.badgeUp')}
      </span>
    );
  if (state.running && state.level > state.targetLevel)
    return (
      <span class="badge warn">
        <Icon name="trendingDown" />
        {t('device.badgeDown')}
      </span>
    );
  if (state.running)
    return (
      <span class="badge ok">
        <Icon name="circlePlay" />
        {t('device.badgeRunning')}
      </span>
    );
  return (
    <span class="badge neutral">
      <Icon name="circleStop" />
      {t('device.badgeStopped')}
    </span>
  );
}

function RampRow({ state }: { state: DeviceState }) {
  const up = state.targetLevel > state.level;
  // Progress from the rpm when a sensor is fitted, otherwise from the levels reached.
  const goalRpm = NOMINAL_RPM[state.targetLevel];
  let pct: number;
  if (up && state.rpm !== null && goalRpm > 0) pct = state.rpm / goalRpm;
  else if (up) pct = state.level / state.targetLevel;
  else pct = 1 - (state.level - state.targetLevel) / Math.max(1, state.level);
  pct = Math.max(0.05, Math.min(1, pct));

  return (
    <div class="ramp" role="status">
      <Icon name={up ? 'trendingUp' : 'trendingDown'} />
      <div style={{ flex: 1 }}>
        <strong>
          {state.targetLevel === 0
            ? t('device.rampStop')
            : up
              ? t('device.rampUp', { n: state.targetLevel })
              : t('device.rampDown', { n: state.targetLevel })}
        </strong>
        <div class="ramp-track" aria-hidden="true">
          <div class="ramp-fill" style={{ width: `${Math.round(pct * 100)}%` }} />
        </div>
        <span class="muted small">{t('device.rampInfo', { now: state.level, target: state.targetLevel })}</span>
      </div>
    </div>
  );
}

function Readouts({ state }: { state: DeviceState }) {
  return (
    <div class="stats">
      <div class="stat">
        <span class="stat-label">{t('device.speedLevel')}</span>
        <span class="stat-value">{state.level}</span>
        <span class="stat-unit">
          {state.level !== state.targetLevel ? t('device.targetN', { n: state.targetLevel }) : levelName(state.level)}
        </span>
      </div>
      <div class="stat">
        <span class="stat-label">{t('device.pedalSpeed')}</span>
        <span class="stat-value">{state.rpm === null ? '–' : Math.round(state.rpm)}</span>
        <span class="stat-unit">{state.rpm === null ? t('device.noSensor') : t('unit.rpm')}</span>
      </div>
      <div class="stat">
        <span class="stat-label">{t('device.current')}</span>
        <span class="stat-value">{state.current === null ? '–' : state.current.toFixed(2)}</span>
        <span class="stat-unit">{state.current === null ? t('device.noSensor') : t('unit.amps')}</span>
      </div>
    </div>
  );
}

function DemoTools() {
  const sim = device.sim();
  if (!sim) return null;
  return (
    <section class="card demo-card" aria-labelledby="demo-title">
      <div class="row-between">
        <h2 id="demo-title">{t('demo.title')}</h2>
        <span class="badge neutral">
          <Icon name="flask" />
          {t('demo.badge')}
        </span>
      </div>
      <div class="set-row first">
        <div class="set-left">
          <span class="set-ic">
            <Icon name="wifiOff" />
          </span>
          <div>
            <strong>{t('demo.drop')}</strong>
            <span class="desc">{t('demo.dropDesc')}</span>
          </div>
        </div>
        <Switch checked={device.simLinkDown.value} label={t('demo.drop')} onChange={(v) => device.setSimLinkDown(v)} />
      </div>
      <div class="set-row column">
        <div class="set-left">
          <span class="set-ic">
            <Icon name="radio" />
          </span>
          <div>
            <strong>{t('demo.ir')}</strong>
            <span class="desc">{t('demo.irDesc')}</span>
          </div>
        </div>
        <div class="ir-pad">
          {([0, 1, 2, 3] as Level[]).map((l) => (
            <button
              key={l}
              type="button"
              class="btn btn-secondary"
              aria-label={t('demo.irKey', { n: l })}
              onClick={() => sim.pressIr(l)}
            >
              {l}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- Connection lost

function LostView() {
  // Bring the alarm into view when the link drops mid-scroll.
  useEffect(() => window.scrollTo({ top: 0 }), []);
  const last = device.state.value;
  const lastAt = device.lastStateAt.value;
  const ago = lastAt ? Math.max(0, Math.round((now.value - lastAt) / 1000)) : null;
  const demo = device.kind.value === 'sim';
  const simDown = device.simLinkDown.value;
  const wait = retryIn();
  const attempt = device.attempt.value;

  return (
    <section class="screen">
      <div class="alarm" role="alert">
        <div class="alarm-top">
          <span class="alarm-ic">
            <Icon name="octagonAlert" />
          </span>
          <div class="stack" style={{ gap: '6px' }}>
            <h2>{t('lost.title')}</h2>
            <p>{t('lost.text')}</p>
          </div>
        </div>
        {demo && simDown ? (
          <button type="button" class="btn btn-primary btn-lg btn-block" onClick={() => device.setSimLinkDown(false)}>
            <Icon name="wifi" />
            {t('lost.restoreDemo')}
          </button>
        ) : (
          <button type="button" class="btn btn-primary btn-lg btn-block" onClick={() => device.retryNow()}>
            <Icon name="rotateCw" />
            {t('lost.reconnect')}
          </button>
        )}
      </div>

      <p class="status-line spin" role="status">
        <Icon name="loader" />
        {demo && simDown
          ? t('lost.simOn')
          : [
              t('lost.retrying'),
              attempt ? t('lost.attempt', { n: attempt }) : '',
              wait !== null ? t('lost.nextIn', { s: wait }) : '',
            ]
              .filter(Boolean)
              .join(' · ')}
      </p>

      {last && (
        <section class="card dim" aria-label={t('lost.lastReadings')}>
          <div class="row-between">
            <h2>{t('lost.lastReadings')}</h2>
            {ago !== null && <span class="muted small">{t('lost.ago', { s: ago })}</span>}
          </div>
          <Readouts state={last} />
        </section>
      )}

      <section class="card">
        <h2>{t('lost.helpTitle')}</h2>
        <ul class="bullets">
          <li>
            <Icon name="power" />
            <span>{t('lost.help1')}</span>
          </li>
          <li>
            <Icon name="smartphone" />
            <span>{t('lost.help2')}</span>
          </li>
          <li>
            <Icon name="wifi" />
            <span>{t('lost.help3')}</span>
          </li>
        </ul>
      </section>

      {!demo && (
        <button type="button" class="btn btn-ghost btn-block" onClick={() => switchMode(true)}>
          <Icon name="flask" />
          {t('lost.useDemo')}
        </button>
      )}
    </section>
  );
}
