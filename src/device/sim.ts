import { MotorModel, type MotorModelOptions } from './motorModel';
import { encodeCommand, encodeState, parseCommand, parseDeviceMessage } from './protocol';
import type { Command, ConnectionStatus, DeviceClient, DeviceState, Level, Unsubscribe } from './types';

export interface SimDeviceOptions extends MotorModelOptions {
  /** Delay before "connected", ms. Default 300. */
  connectDelayMs?: number;
  /** Physics tick, ms. Default 100. */
  tickMs?: number;
  /** Periodic state broadcast, ms. Default 1000 (matches the firmware). */
  broadcastMs?: number;
  /** Add small random jitter to rpm/current so live data looks real. Default true. */
  jitter?: boolean;
}

/**
 * Simulated MOTION-X device for Demo mode. It runs the same rules as the firmware
 * (via MotorModel) and talks JSON strings through the protocol module, like RealDevice.
 */
export class SimDevice implements DeviceClient {
  readonly kind = 'sim' as const;

  private readonly model: MotorModel;
  private readonly opts: Required<Omit<SimDeviceOptions, keyof MotorModelOptions>>;
  private status: ConnectionStatus = 'disconnected';
  private state: DeviceState | null = null;
  private lastStateAt: number | null = null;
  private lastSent = '';
  private linkDown = false;
  private timers: ReturnType<typeof setInterval>[] = [];
  private connectTimer: ReturnType<typeof setTimeout> | null = null;
  private stateListeners = new Set<(s: DeviceState) => void>();
  private statusListeners = new Set<(s: ConnectionStatus) => void>();

  constructor(options: SimDeviceOptions = {}) {
    this.model = new MotorModel(Date.now(), options);
    this.opts = {
      connectDelayMs: options.connectDelayMs ?? 300,
      tickMs: options.tickMs ?? 100,
      broadcastMs: options.broadcastMs ?? 1000,
      jitter: options.jitter ?? true,
    };
    // The simulated motor is "powered" from creation, so it keeps obeying its
    // heartbeat timeout even while the app is disconnected.
    this.timers.push(setInterval(() => this.deviceTick(false), this.opts.tickMs));
    this.timers.push(setInterval(() => this.deviceTick(true), this.opts.broadcastMs));
  }

  connect(): Promise<void> {
    if (this.status !== 'disconnected') return Promise.resolve();
    this.setStatus('connecting');
    return new Promise((resolve) => {
      this.connectTimer = setTimeout(() => {
        this.connectTimer = null;
        this.setStatus('connected');
        this.deviceTick(true);
        resolve();
      }, this.opts.connectDelayMs);
    });
  }

  disconnect(): void {
    if (this.connectTimer) clearTimeout(this.connectTimer);
    this.connectTimer = null;
    this.setStatus('disconnected');
  }

  /** Stop all timers. Call when the simulator is no longer needed. */
  dispose(): void {
    this.disconnect();
    this.timers.forEach(clearInterval);
    this.timers = [];
    this.stateListeners.clear();
    this.statusListeners.clear();
  }

  send(command: Command): boolean {
    if (this.status !== 'connected') return false;
    if (this.linkDown) return true; // handed to the transport, silently lost in the air
    const parsed = parseCommand(encodeCommand(command));
    if (!parsed) return false;
    this.model.command(parsed, Date.now(), 'app');
    this.deviceTick(true); // device answers every command with its state
    return true;
  }

  getStatus(): ConnectionStatus {
    return this.status;
  }

  getState(): DeviceState | null {
    return this.state;
  }

  getLastStateAt(): number | null {
    return this.lastStateAt;
  }

  onState(listener: (state: DeviceState) => void): Unsubscribe {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  onStatus(listener: (status: ConnectionStatus) => void): Unsubscribe {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  // ---- Demo controls (not part of DeviceClient) ----

  /** Simulate Wi-Fi dropping out: messages in both directions are lost, socket stays "open". */
  setLinkDown(down: boolean): void {
    this.linkDown = down;
    if (!down) this.deviceTick(true);
  }

  isLinkDown(): boolean {
    return this.linkDown;
  }

  /** Simulate a key press on the IR remote (0 = stop, 1..3 = level). */
  pressIr(level: Level): void {
    this.model.command(level === 0 ? { cmd: 'stop' } : { cmd: 'set_speed', level }, Date.now(), 'ir');
    this.deviceTick(true);
  }

  /** Raw model output 0..1, for tests. */
  getMotorOutput(): number {
    return this.model.getOutput();
  }

  // ---- internals ----

  private deviceTick(forceBroadcast: boolean): void {
    this.model.tick(Date.now());
    const s = this.model.getState();
    // Compare without the continuously changing telemetry: broadcast immediately on real changes.
    const key = `${s.level}|${s.targetLevel}|${s.running}|${s.fault}|${s.source}`;
    const changed = key !== this.lastSent;
    if (!forceBroadcast && !changed) return;
    this.lastSent = key;
    this.deliver(this.withJitter(s));
  }

  private withJitter(s: DeviceState): DeviceState {
    if (!this.opts.jitter || !s.running) return s;
    const j = (scale: number) => (Math.random() - 0.5) * scale;
    return {
      ...s,
      rpm: s.rpm === null ? null : Math.max(0, Math.round((s.rpm + j(1)) * 10) / 10),
      current: s.current === null ? null : Math.max(0, Math.round((s.current + j(0.06)) * 100) / 100),
    };
  }

  private deliver(s: DeviceState): void {
    if (this.status !== 'connected' || this.linkDown) return;
    const parsed = parseDeviceMessage(encodeState(s));
    if (!parsed) return;
    this.state = parsed;
    this.lastStateAt = Date.now();
    this.stateListeners.forEach((l) => l(parsed));
  }

  private setStatus(status: ConnectionStatus): void {
    if (status === this.status) return;
    this.status = status;
    this.statusListeners.forEach((l) => l(status));
  }
}
