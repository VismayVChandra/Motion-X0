import { computed, signal, type ReadonlySignal } from '@preact/signals';
import type { LinkState } from '../device/controller';
import type { DeviceState, Level } from '../device/types';
import { buildSchedule, cyclesFor, phaseAt, type PatternId, type Phase, type SpeedLevel } from './patterns';

export type RunStatus = 'idle' | 'running' | 'paused' | 'finished';
/** user: Pause button · connection: link lost · device_stopped: IR remote or device safety stop */
export type PauseReason = 'user' | 'connection' | 'device_stopped';
export type EndReason = 'completed' | 'ended_early' | 'estop';

export interface SessionConfig {
  durationSec: number;
  level: SpeedLevel;
  pattern: PatternId;
}

export interface SessionResult {
  startedAt: number;
  endedAt: number;
  plannedSec: number;
  activeSec: number;
  level: SpeedLevel;
  pattern: PatternId;
  cycles: number;
  endReason: EndReason;
  mode: 'demo' | 'device';
}

/** What the runner needs from the device controller (lets tests pass a fake). */
export interface SessionDevice {
  readonly state: ReadonlySignal<DeviceState | null>;
  readonly link: ReadonlySignal<LinkState>;
  readonly kind: ReadonlySignal<'real' | 'sim' | null>;
  setLevel(level: Level): boolean;
  stop(): boolean;
}

export const TICK_MS = 250;
/** After commanding a level, wait this long before trusting the device's reported target. */
export const COMMAND_GRACE_MS = 1500;
/** Longest gap counted as exercise time (e.g. after the browser throttled timers). */
const MAX_TICK_GAP_MS = 1000;

export type StartBlock = 'not_connected' | 'estop' | 'not_ready' | 'already_running';

/** A device fault that blocks speed commands but is not the e-stop or a heartbeat timeout (e.g. ESC arming). */
export const isNotReadyFault = (fault: string | null | undefined) =>
  !!fault && fault !== 'estop' && fault !== 'heartbeat_timeout';

/**
 * Runs one exercise session: timer, pattern phases → device levels, cycle count,
 * automatic pause when the link drops or the device stops, and the final result.
 */
export class SessionRunner {
  readonly status = signal<RunStatus>('idle');
  readonly pauseReason = signal<PauseReason | null>(null);
  readonly config = signal<SessionConfig | null>(null);
  readonly schedule = signal<Phase[]>([]);
  readonly activeMs = signal(0);
  readonly cycles = signal(0);
  readonly result = signal<SessionResult | null>(null);

  readonly plannedMs = computed(() => (this.config.value?.durationSec ?? 0) * 1000);
  readonly remainingMs = computed(() => Math.max(0, this.plannedMs.value - this.activeMs.value));
  readonly progress = computed(() => (this.plannedMs.value ? Math.min(1, this.activeMs.value / this.plannedMs.value) : 0));
  readonly phase = computed(() =>
    this.schedule.value.length ? phaseAt(this.schedule.value, this.activeMs.value / 1000) : null,
  );
  /** A session is underway (running or paused). */
  readonly inProgress = computed(() => this.status.value === 'running' || this.status.value === 'paused');

  private timer: ReturnType<typeof setInterval> | null = null;
  private lastTick = 0;
  private startedAt = 0;
  private lastCommanded: SpeedLevel | null = null;
  private commandedAt = 0;

  constructor(
    private readonly device: SessionDevice,
    private readonly onFinish: (result: SessionResult) => void = () => {},
  ) {}

  /** Why a session cannot start right now, or null if it can. */
  canStart(): StartBlock | null {
    if (this.inProgress.peek()) return 'already_running';
    if (this.device.link.peek() !== 'connected' || !this.device.state.peek()) return 'not_connected';
    const fault = this.device.state.peek()?.fault;
    if (fault === 'estop') return 'estop';
    if (isNotReadyFault(fault)) return 'not_ready';
    return null;
  }

  start(config: SessionConfig): boolean {
    if (this.canStart()) return false;
    this.config.value = config;
    this.schedule.value = buildSchedule(config.pattern, config.durationSec, config.level);
    this.activeMs.value = 0;
    this.cycles.value = 0;
    this.result.value = null;
    this.pauseReason.value = null;
    this.startedAt = Date.now();
    this.lastCommanded = null;
    this.status.value = 'running';
    this.lastTick = Date.now();
    this.tick(); // command the first level right away
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => this.tick(), TICK_MS);
    return true;
  }

  /** User pause: stops the motor and freezes the timer. */
  pause(): void {
    this.pauseFor('user');
  }

  /** Resume after any pause. Returns false if the device is not ready. */
  resume(): boolean {
    if (this.status.peek() !== 'paused') return false;
    if (this.device.link.peek() !== 'connected' || this.device.state.peek()?.fault === 'estop') return false;
    this.pauseReason.value = null;
    this.lastCommanded = null;
    this.lastTick = Date.now();
    this.status.value = 'running';
    this.tick();
    return true;
  }

  /** End now (saved as completed if the time is up, otherwise "ended early"). */
  end(): void {
    if (!this.inProgress.peek()) return;
    this.finish(this.activeMs.peek() >= this.plannedMs.peek() ? 'completed' : 'ended_early');
  }

  /** Forget a finished session (back to idle). */
  clear(): void {
    if (this.inProgress.peek()) return;
    this.status.value = 'idle';
    this.config.value = null;
    this.schedule.value = [];
  }

  dispose(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  // ---------- internals ----------

  private tick(): void {
    const status = this.status.peek();
    if (status !== 'running' && status !== 'paused') return;
    const st = this.device.state.peek();

    if (st?.fault === 'estop') {
      this.finish('estop');
      return;
    }
    const now = Date.now();
    const dt = Math.min(MAX_TICK_GAP_MS, Math.max(0, now - this.lastTick));
    this.lastTick = now;
    if (status === 'paused') return;

    if (this.device.link.peek() !== 'connected') {
      this.pauseFor('connection');
      return;
    }

    if (st?.running) this.cycles.value = this.cycles.peek() + cyclesFor(st.rpm, st.level, dt);
    const active = this.activeMs.peek() + dt;
    this.activeMs.value = Math.min(active, this.plannedMs.peek());
    if (active >= this.plannedMs.peek()) {
      this.finish('completed');
      return;
    }

    const desired = phaseAt(this.schedule.peek(), active / 1000).phase.level;
    if (desired !== this.lastCommanded) {
      this.device.setLevel(desired);
      this.lastCommanded = desired;
      this.commandedAt = now;
    } else if (st && now - this.commandedAt > COMMAND_GRACE_MS) {
      if (st.targetLevel === 0) {
        this.pauseFor('device_stopped'); // IR remote stop or a device-side safety stop
      } else if (st.targetLevel !== desired) {
        this.device.setLevel(desired); // command was lost or overridden: ask again
        this.commandedAt = now;
      }
    }
  }

  private pauseFor(reason: PauseReason): void {
    if (this.status.peek() !== 'running') return;
    this.status.value = 'paused';
    this.pauseReason.value = reason;
    this.lastCommanded = null;
    this.device.stop();
  }

  private finish(reason: EndReason): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (reason !== 'estop') this.device.stop();
    const cfg = this.config.peek()!;
    const result: SessionResult = {
      startedAt: this.startedAt,
      endedAt: Date.now(),
      plannedSec: cfg.durationSec,
      activeSec: Math.round(this.activeMs.peek() / 1000),
      level: cfg.level,
      pattern: cfg.pattern,
      cycles: Math.round(this.cycles.peek()),
      endReason: reason,
      mode: this.device.kind.peek() === 'real' ? 'device' : 'demo',
    };
    this.result.value = result;
    this.pauseReason.value = null;
    this.status.value = 'finished';
    this.onFinish(result);
  }
}
