import { signal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { device, now } from '../device/instance';
import { NOMINAL_RPM } from '../device/protocol';
import type { DeviceState, Level } from '../device/types';
import { settingsStore } from '../store/settings';
import { Icon } from '../ui/Icon';
import { Switch } from '../ui/controls';

export const LEVEL_NAMES: Record<1 | 2 | 3, string> = { 1: 'Gentle', 2: 'Steady', 3: 'Brisk' };
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

// ---------------------------------------------------------------- Connect

function ConnectView() {
  const link = device.link.value;
  const demo = settingsStore.settings.value.demoMode;
  const searching = link === 'connecting';
  const retryIn = device.nextRetryAt.value ? Math.max(0, Math.ceil((device.nextRetryAt.value - now.value) / 1000)) : null;

  return (
    <section class="screen" aria-labelledby="connect-title">
      <div class="hero-icon">
        <Icon name={demo ? 'flask' : 'wifi'} />
      </div>
      <div class="stack" style={{ gap: '8px' }}>
        <h1 id="connect-title">{demo ? 'Demo device' : 'Connect to your MOTION-X'}</h1>
        <p class="lead">
          {demo
            ? 'Demo mode uses a simulated machine. Nothing moves, and every screen works.'
            : 'Your phone talks to the machine over its own Wi-Fi. No internet needed.'}
        </p>
      </div>

      {!demo && (
        <ol class="steps card">
          <li>
            <span class="step-n">1</span>
            <strong>Switch on the machine</strong>
          </li>
          <li>
            <span class="step-n">2</span>
            <div class="stack">
              <strong>Join the “MOTION-X” Wi-Fi</strong>
              <span class="muted small">If your phone says “no internet”, choose to stay connected.</span>
            </div>
          </li>
          <li>
            <span class="step-n">3</span>
            <strong>Come back here. The app connects by itself.</strong>
          </li>
        </ol>
      )}

      {searching && (
        <div class="card status-card" role="status">
          <span class="spin-ic spin">
            <Icon name="loader" />
          </span>
          <div class="stack">
            <strong>{demo ? 'Starting demo device…' : 'Looking for MOTION-X…'}</strong>
            <span class="muted small">
              {device.attempt.value > 0
                ? `Auto-reconnect is on${retryIn !== null ? ` · next try in ${retryIn} s` : ''}`
                : 'This takes a moment'}
            </span>
          </div>
        </div>
      )}

      {device.error.value && searching && (
        <p class="field-error" role="alert">
          {device.error.value}
        </p>
      )}

      {searching ? (
        <div class="btn-pair">
          <button type="button" class="btn btn-primary btn-lg" onClick={() => device.retryNow()}>
            <Icon name="rotateCw" />
            Try now
          </button>
          <button type="button" class="btn btn-secondary btn-lg" onClick={() => device.disconnect()}>
            Cancel
          </button>
        </div>
      ) : (
        <button type="button" class="btn btn-primary btn-lg btn-block" onClick={() => void device.connect()}>
          <Icon name="link" />
          {demo ? 'Start demo device' : 'Connect to device'}
        </button>
      )}

      <div class="divider">or</div>
      {demo ? (
        <button type="button" class="btn btn-secondary btn-lg btn-block" onClick={() => switchMode(false)}>
          <Icon name="wifi" />
          Use the real device
        </button>
      ) : (
        <button type="button" class="btn btn-secondary btn-lg btn-block" onClick={() => switchMode(true)}>
          <Icon name="flask" />
          Use Demo mode <span class="btn-sub">(simulated device)</span>
        </button>
      )}
    </section>
  );
}

/** Switch Demo mode and make sure we end up connecting. */
function switchMode(demo: boolean) {
  settingsStore.update({ demoMode: demo }); // instance effect reconfigures if already connecting
  void device.connect();
}

// ---------------------------------------------------------------- Control

function ControlView({ state }: { state: DeviceState }) {
  const chosen = chosenLevel.value;
  const active = state.running || state.targetLevel > 0;
  const estop = state.fault === 'estop';
  const timedOut = state.fault === 'heartbeat_timeout';
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
        <h1 id="device-title">Device</h1>
        <MotorBadge state={state} />
      </div>

      {estop && (
        <div class="alarm" role="alert">
          <div class="alarm-top">
            <span class="alarm-ic">
              <Icon name="octagonX" />
            </span>
            <div class="stack" style={{ gap: '6px' }}>
              <h2>Emergency stop is on</h2>
              <p>The motor is stopped. Check that everyone is safe before you reset.</p>
            </div>
          </div>
          <button
            type="button"
            class="btn btn-secondary btn-lg btn-block"
            disabled={state.running}
            onClick={() => device.reset()}
          >
            <Icon name="rotateCcw" />
            Reset emergency stop
          </button>
        </div>
      )}

      {timedOut && !active && (
        <div class="advisory" role="status">
          <Icon name="triangleAlert" />
          <div>
            <strong>The motor stopped for safety</strong>
            <p>The connection dropped, so the machine stopped on its own. Press Start to continue.</p>
          </div>
        </div>
      )}

      <div class="btn-pair">
        <button
          type="button"
          class="btn btn-primary btn-lg"
          aria-disabled={active || estop}
          disabled={estop}
          onClick={() => !active && device.start(chosen)}
        >
          <Icon name={active ? 'check' : 'play'} />
          {active ? 'Running' : 'Start'}
        </button>
        <button type="button" class="btn btn-secondary btn-lg" disabled={!active} onClick={() => device.stop()}>
          <Icon name="square" />
          Stop motor
        </button>
      </div>

      <section class="card" aria-labelledby="speed-title">
        <h2 id="speed-title">Speed level</h2>
        <div class="seg" role="radiogroup" aria-label="Speed level" style={{ paddingTop: '8px' }}>
          {SPEEDS.map((l) => {
            const selected = l === target;
            const isNow = ramping && state.level === l && !selected;
            return (
              <button
                key={l}
                type="button"
                class={`seg-btn${isNow ? ' is-current' : ''}`}
                role="radio"
                aria-checked={selected}
                aria-label={`Level ${l}, ${LEVEL_NAMES[l]}${isNow ? ', current' : ''}${selected && ramping ? ', target' : ''}`}
                disabled={estop}
                onClick={() => pickLevel(l)}
              >
                {selected && ramping && <span class="seg-tag">Target</span>}
                {isNow && <span class="seg-tag">Now</span>}
                <span class="seg-main">{l}</span>
                <span class="seg-sub">{LEVEL_NAMES[l]}</span>
              </button>
            );
          })}
        </div>
        {ramping && <RampRow state={state} />}
        {!active && !estop && <p class="muted small">Pick a level, then press Start. The motor speeds up gently.</p>}
      </section>

      <section class="stack" style={{ gap: '10px' }} aria-labelledby="live-title">
        <div class="row-between">
          <h2 id="live-title">Live readouts</h2>
          <span class="live-label">
            <span class="live-dot" />
            Live
          </span>
        </div>
        <Readouts state={state} />
      </section>

      {demo && <DemoTools />}

      <button type="button" class="btn btn-ghost btn-block" onClick={() => device.disconnect()}>
        <Icon name="unplug" />
        Disconnect
      </button>
    </section>
  );
}

function MotorBadge({ state }: { state: DeviceState }) {
  if (state.fault === 'estop')
    return (
      <span class="badge danger">
        <Icon name="octagonX" />
        Emergency stop
      </span>
    );
  if (state.running && state.level < state.targetLevel)
    return (
      <span class="badge ok">
        <Icon name="trendingUp" />
        Speeding up
      </span>
    );
  if (state.running && state.level > state.targetLevel)
    return (
      <span class="badge warn">
        <Icon name="trendingDown" />
        Slowing down
      </span>
    );
  if (state.running)
    return (
      <span class="badge ok">
        <Icon name="circlePlay" />
        Motor running
      </span>
    );
  return (
    <span class="badge neutral">
      <Icon name="circleStop" />
      Stopped
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
          {state.targetLevel === 0 ? 'Slowing to a stop…' : `${up ? 'Speeding up' : 'Slowing'} to level ${state.targetLevel}…`}
        </strong>
        <div class="ramp-track" aria-hidden="true">
          <div class="ramp-fill" style={{ width: `${Math.round(pct * 100)}%` }} />
        </div>
        <span class="muted small">
          Now {state.level} · Target {state.targetLevel} · changes are always gradual
        </span>
      </div>
    </div>
  );
}

function Readouts({ state, dim }: { state: DeviceState; dim?: boolean }) {
  return (
    <div class={`stats${dim ? ' dim' : ''}`}>
      <div class="stat">
        <span class="stat-label">Speed level</span>
        <span class="stat-value">{state.level}</span>
        <span class="stat-unit">
          {state.level !== state.targetLevel ? `target ${state.targetLevel}` : state.level === 0 ? 'stopped' : LEVEL_NAMES[state.level]}
        </span>
      </div>
      <div class="stat">
        <span class="stat-label">Pedal speed</span>
        <span class="stat-value">{state.rpm === null ? '–' : Math.round(state.rpm)}</span>
        <span class="stat-unit">{state.rpm === null ? 'no sensor' : 'rpm'}</span>
      </div>
      <div class="stat">
        <span class="stat-label">Motor current</span>
        <span class="stat-value">{state.current === null ? '–' : state.current.toFixed(2)}</span>
        <span class="stat-unit">{state.current === null ? 'no sensor' : 'amps'}</span>
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
        <h2 id="demo-title">Demo tools</h2>
        <span class="badge neutral">
          <Icon name="flask" />
          Simulator only
        </span>
      </div>
      <div class="set-row first">
        <div class="set-left">
          <span class="set-ic">
            <Icon name="wifiOff" />
          </span>
          <div>
            <strong>Simulate connection drop</strong>
            <span class="desc">Messages stop both ways. The machine stops itself after 2 s.</span>
          </div>
        </div>
        <Switch
          checked={device.simLinkDown.value}
          label="Simulate connection drop"
          onChange={(v) => device.setSimLinkDown(v)}
        />
      </div>
      <div class="set-row column">
        <div class="set-left">
          <span class="set-ic">
            <Icon name="radio" />
          </span>
          <div>
            <strong>IR remote</strong>
            <span class="desc">0 = stop, 1–3 = speed level. Works without the app’s heartbeat.</span>
          </div>
        </div>
        <div class="ir-pad">
          {([0, 1, 2, 3] as Level[]).map((l) => (
            <button key={l} type="button" class="btn btn-secondary" onClick={() => sim.pressIr(l)}>
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
  const retryIn = device.nextRetryAt.value ? Math.max(0, Math.ceil((device.nextRetryAt.value - now.value) / 1000)) : null;

  return (
    <section class="screen">
      <div class="alarm" role="alert">
        <div class="alarm-top">
          <span class="alarm-ic">
            <Icon name="octagonAlert" />
          </span>
          <div class="stack" style={{ gap: '6px' }}>
            <h2>Connection lost: motor stopped</h2>
            <p>The machine stops the motor on its own when it loses contact with the app. This is a safety step.</p>
          </div>
        </div>
        {demo && simDown ? (
          <button type="button" class="btn btn-primary btn-lg btn-block" onClick={() => device.setSimLinkDown(false)}>
            <Icon name="wifi" />
            Restore connection (demo)
          </button>
        ) : (
          <button type="button" class="btn btn-primary btn-lg btn-block" onClick={() => device.retryNow()}>
            <Icon name="rotateCw" />
            Reconnect
          </button>
        )}
      </div>

      <p class="status-line spin" role="status">
        <Icon name="loader" />
        {demo && simDown
          ? 'Simulated drop is on'
          : `Trying again automatically${device.attempt.value ? ` · attempt ${device.attempt.value}` : ''}${retryIn !== null ? ` · next in ${retryIn} s` : ''}`}
      </p>

      {last && (
        <section class="card dim" aria-label="Last readings">
          <div class="row-between">
            <h2>Last readings</h2>
            {ago !== null && <span class="muted small">{ago} s ago</span>}
          </div>
          <Readouts state={last} />
        </section>
      )}

      <section class="card">
        <h2>If this keeps happening</h2>
        <ul class="bullets">
          <li>
            <Icon name="power" />
            <span>Check the machine is switched on</span>
          </li>
          <li>
            <Icon name="smartphone" />
            <span>Keep your phone within a few metres of the machine</span>
          </li>
          <li>
            <Icon name="wifi" />
            <span>Rejoin the “MOTION-X” Wi-Fi</span>
          </li>
        </ul>
      </section>

      {!demo && (
        <button type="button" class="btn btn-ghost btn-block" onClick={() => switchMode(true)}>
          <Icon name="flask" />
          Use Demo mode instead
        </button>
      )}
    </section>
  );
}
