/** Speed level. 0 = stop, 1..3 = speed levels (matches the IR remote mapping). */
export type Level = 0 | 1 | 2 | 3;

export type FaultCode = 'estop' | 'heartbeat_timeout' | 'esc_not_armed' | (string & {});

export type ControlSource = 'app' | 'ir' | 'none';

/** App → device commands (see docs/protocol.md). */
export type Command =
  | { cmd: 'set_speed'; level: Level }
  | { cmd: 'stop' }
  | { cmd: 'estop' }
  | { cmd: 'reset' }
  | { cmd: 'ping' };

/** Device state as used inside the app (camelCase; the wire format is snake_case). */
export interface DeviceState {
  /** Level the output has actually reached. */
  level: Level;
  /** Level requested; differs from `level` while ramping. */
  targetLevel: Level;
  running: boolean;
  rpm: number | null;
  current: number | null;
  fault: FaultCode | null;
  source: ControlSource;
}

/** Transport status, separate from what the device reports. */
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

export type Unsubscribe = () => void;

/**
 * The only way the app talks to a device. `RealDevice` (WebSocket) and
 * `SimDevice` (Demo mode) both implement it, so screens never know which one is active.
 */
export interface DeviceClient {
  readonly kind: 'real' | 'sim';
  connect(): Promise<void>;
  disconnect(): void;
  /** Fire-and-forget. Returns false if the command could not be handed to the transport. */
  send(command: Command): boolean;
  getStatus(): ConnectionStatus;
  /** Last state received from the device, or null before the first one. */
  getState(): DeviceState | null;
  /** Timestamp (ms, Date.now) of the last state message received, or null. */
  getLastStateAt(): number | null;
  onState(listener: (state: DeviceState) => void): Unsubscribe;
  onStatus(listener: (status: ConnectionStatus) => void): Unsubscribe;
}
