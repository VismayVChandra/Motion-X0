import { computed, signal } from '@preact/signals';
import { HEARTBEAT_INTERVAL_MS, HEARTBEAT_TIMEOUT_MS } from './protocol';
import { ConnectError, type ConnectErrorCode } from './real';
import { SimDevice } from './sim';
import type { Command, ConnectionStatus, DeviceClient, DeviceState, Level, Unsubscribe } from './types';

/**
 * idle        not trying to connect
 * connecting  trying to reach the device for the first time (retries automatically)
 * connected   socket open and state messages arriving
 * lost        was connected, now silent for 2 s or the socket closed (retries automatically).
 *             The device stops the motor by itself in this case.
 */
export type LinkState = 'idle' | 'connecting' | 'connected' | 'lost';

export const RECONNECT_DELAYS_MS = [1000, 2000, 4000, 5000] as const;
/** If a real socket stays open but silent this long, close it and reconnect. */
export const STALE_SOCKET_MS = 6000;
const WATCHDOG_MS = 250;
const ESTOP_RETRY_MS = 200;
const ESTOP_MAX_TRIES = 10;

/**
 * Owns the active DeviceClient and the app-side safety behaviour:
 * heartbeat while connected, "connection lost" detection, auto-reconnect, e-stop retries.
 */
export class DeviceController {
  readonly link = signal<LinkState>('idle');
  readonly state = signal<DeviceState | null>(null);
  readonly lastStateAt = signal<number | null>(null);
  readonly attempt = signal(0);
  readonly nextRetryAt = signal<number | null>(null);
  /** Why the last connection attempt failed (the UI translates the code). */
  readonly error = signal<ConnectErrorCode | null>(null);
  readonly kind = signal<'real' | 'sim' | null>(null);
  /** Bumped when the simulator's link-down flag changes, so the UI re-renders. */
  readonly simLinkDown = signal(false);

  /** Motor is (or was last seen) running or ramping toward a level. */
  readonly active = computed(() => {
    const s = this.state.value;
    return !!s && (s.running || s.targetLevel > 0);
  });

  private client: DeviceClient | null = null;
  private unsubs: Unsubscribe[] = [];
  private wanted = false;
  private everConnected = false;
  private connectingNow = false;
  private connectedAt = 0;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private watchdogTimer: ReturnType<typeof setInterval> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private estopTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly createClient: () => DeviceClient) {}

  // ---------- connection ----------

  async connect(): Promise<void> {
    if (this.wanted) return;
    this.wanted = true;
    this.everConnected = false;
    this.attempt.value = 0;
    this.error.value = null;
    this.state.value = null;
    this.lastStateAt.value = null;
    this.ensureClient();
    this.startTimers();
    await this.tryConnect();
  }

  /** Stop trying. Sends a stop first if the motor is active. */
  disconnect(): void {
    if (this.active.peek()) this.send({ cmd: 'stop' });
    this.wanted = false;
    this.clearTimers();
    this.client?.disconnect();
    this.link.value = 'idle';
    this.attempt.value = 0;
    this.nextRetryAt.value = null;
  }

  /** Retry immediately instead of waiting for the next automatic attempt. */
  retryNow(): void {
    if (!this.wanted || !this.client) return;
    this.clearRetry();
    if (this.client.getStatus() !== 'disconnected') {
      this.connectingNow = true; // swallow the status event from our own disconnect
      this.client.disconnect();
      this.connectingNow = false;
    }
    void this.tryConnect();
  }

  /** Replace the client (Demo mode or address changed). Reconnects if we were connected. */
  reconfigure(): void {
    const was = this.wanted;
    this.disconnect();
    this.dropClient();
    this.state.value = null;
    this.lastStateAt.value = null;
    this.error.value = null;
    if (was) void this.connect();
  }

  dispose(): void {
    this.disconnect();
    this.dropClient();
  }

  /** The simulator, when Demo mode is active (for demo-only controls). */
  sim(): SimDevice | null {
    return this.client instanceof SimDevice ? this.client : null;
  }

  setSimLinkDown(down: boolean): void {
    const sim = this.sim();
    if (!sim) return;
    sim.setLinkDown(down);
    this.simLinkDown.value = down;
  }

  // ---------- commands ----------

  send(command: Command): boolean {
    const c = this.client;
    if (!c || c.getStatus() !== 'connected') return false;
    return c.send(command);
  }

  start(level: Level): boolean {
    return this.send({ cmd: 'set_speed', level });
  }

  setLevel(level: Level): boolean {
    return this.send({ cmd: 'set_speed', level });
  }

  stop(): boolean {
    return this.send({ cmd: 'stop' });
  }

  reset(): boolean {
    return this.send({ cmd: 'reset' });
  }

  /**
   * Send `estop` now and keep re-sending until the device confirms the latch (or give up
   * after ~2 s). If the link is down, the device has already stopped by its own timeout.
   */
  emergencyStop(): boolean {
    const sent = this.send({ cmd: 'estop' });
    if (this.estopTimer) clearInterval(this.estopTimer);
    let tries = 1;
    this.estopTimer = setInterval(() => {
      if (this.state.peek()?.fault === 'estop' || tries >= ESTOP_MAX_TRIES) {
        if (this.estopTimer) clearInterval(this.estopTimer);
        this.estopTimer = null;
        return;
      }
      tries++;
      this.send({ cmd: 'estop' });
    }, ESTOP_RETRY_MS);
    return sent;
  }

  // ---------- internals ----------

  private ensureClient() {
    if (this.client) return;
    const c = this.createClient();
    this.client = c;
    this.kind.value = c.kind;
    this.simLinkDown.value = c instanceof SimDevice ? c.isLinkDown() : false;
    this.unsubs = [c.onState((s) => this.handleState(s)), c.onStatus((s) => this.handleStatus(s))];
  }

  private dropClient() {
    this.unsubs.forEach((u) => u());
    this.unsubs = [];
    if (this.client instanceof SimDevice) this.client.dispose();
    this.client = null;
    this.kind.value = null;
    this.simLinkDown.value = false;
  }

  private async tryConnect(): Promise<void> {
    this.clearRetry();
    const c = this.client;
    if (!this.wanted || !c) return;
    this.link.value = this.everConnected ? 'lost' : 'connecting';
    this.connectingNow = true;
    try {
      await c.connect();
    } catch (e) {
      this.connectingNow = false;
      if (!this.wanted || this.client !== c) return;
      this.error.value = e instanceof ConnectError ? e.code : 'unreachable';
      this.scheduleRetry();
      return;
    }
    this.connectingNow = false;
    if (!this.wanted || this.client !== c) return;
    this.everConnected = true;
    this.error.value = null;
    this.attempt.value = 0;
    this.connectedAt = Date.now();
    this.link.value = 'connected';
    c.send({ cmd: 'ping' });
  }

  private scheduleRetry() {
    if (!this.wanted || this.retryTimer) return;
    const delay = RECONNECT_DELAYS_MS[Math.min(this.attempt.peek(), RECONNECT_DELAYS_MS.length - 1)];
    this.attempt.value = this.attempt.peek() + 1;
    this.nextRetryAt.value = Date.now() + delay;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      void this.tryConnect();
    }, delay);
  }

  private clearRetry() {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    this.nextRetryAt.value = null;
  }

  private handleState(s: DeviceState) {
    this.state.value = s;
    this.lastStateAt.value = Date.now();
    if (this.link.peek() === 'lost' && this.client?.getStatus() === 'connected') this.link.value = 'connected';
  }

  private handleStatus(status: ConnectionStatus) {
    if (status !== 'disconnected' || this.connectingNow || !this.wanted) return;
    if (this.everConnected) this.link.value = 'lost';
    this.scheduleRetry();
  }

  private startTimers() {
    this.clearTimers();
    this.heartbeatTimer = setInterval(() => {
      if (this.client?.getStatus() === 'connected') this.client.send({ cmd: 'ping' });
    }, HEARTBEAT_INTERVAL_MS);
    this.watchdogTimer = setInterval(() => this.watchdog(), WATCHDOG_MS);
  }

  private watchdog() {
    const c = this.client;
    if (!c || c.getStatus() !== 'connected') return;
    const fresh = Math.max(this.lastStateAt.peek() ?? 0, this.connectedAt);
    const silentFor = Date.now() - fresh;
    if (this.link.peek() === 'connected' && silentFor > HEARTBEAT_TIMEOUT_MS) {
      this.link.value = 'lost';
    }
    // A real socket can stay "open" after Wi-Fi drops; force a fresh connection.
    if (this.link.peek() === 'lost' && c.kind === 'real' && silentFor > STALE_SOCKET_MS) {
      c.disconnect(); // triggers handleStatus → scheduleRetry
    }
  }

  private clearTimers() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.watchdogTimer) clearInterval(this.watchdogTimer);
    if (this.estopTimer) clearInterval(this.estopTimer);
    this.heartbeatTimer = this.watchdogTimer = this.estopTimer = null;
    this.clearRetry();
  }
}
