import { encodeCommand, parseDeviceMessage } from './protocol';
import type { Command, ConnectionStatus, DeviceClient, DeviceState, Unsubscribe } from './types';

/** The subset of the browser WebSocket that RealDevice uses (lets tests pass a fake). */
export interface SocketLike {
  readonly readyState: number;
  onopen: ((ev: unknown) => void) | null;
  onclose: ((ev: unknown) => void) | null;
  onerror: ((ev: unknown) => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
  send(data: string): void;
  close(): void;
}

export type SocketFactory = (url: string) => SocketLike;

const OPEN = 1;

export const defaultSocketFactory: SocketFactory = (url) => new WebSocket(url) as unknown as SocketLike;

export type ConnectErrorCode = 'mixed_content' | 'invalid_address' | 'timeout' | 'unreachable' | 'cancelled' | 'busy';

/** Connection failure with a stable code (the UI translates the code; the message is for logs). */
export class ConnectError extends Error {
  constructor(
    readonly code: ConnectErrorCode,
    message: string,
  ) {
    super(message);
  }
}

/** True when the page is HTTPS and the device URL is plain ws:// (browsers block that). */
export function isMixedContent(url: string, pageProtocol = typeof location === 'undefined' ? '' : location.protocol) {
  return pageProtocol === 'https:' && url.startsWith('ws:');
}

/** WebSocket client for the real ESP32 (docs/protocol.md). Reconnecting is the controller's job. */
export class RealDevice implements DeviceClient {
  readonly kind = 'real' as const;

  private ws: SocketLike | null = null;
  private status: ConnectionStatus = 'disconnected';
  private state: DeviceState | null = null;
  private lastStateAt: number | null = null;
  private pendingReject: ((e: Error) => void) | null = null;
  private stateListeners = new Set<(s: DeviceState) => void>();
  private statusListeners = new Set<(s: ConnectionStatus) => void>();

  constructor(
    readonly url: string,
    private readonly factory: SocketFactory = defaultSocketFactory,
    private readonly connectTimeoutMs = 4000,
  ) {}

  connect(): Promise<void> {
    if (this.ws) return this.status === 'connected' ? Promise.resolve() : Promise.reject(new ConnectError('busy', 'Already connecting'));
    if (isMixedContent(this.url)) {
      return Promise.reject(
        new ConnectError('mixed_content', 'This page was opened over HTTPS, so the browser blocks ws:// connections. Open the app from the device at http://192.168.4.1.'),
      );
    }

    this.setStatus('connecting');
    return new Promise<void>((resolve, reject) => {
      let ws: SocketLike;
      try {
        ws = this.factory(this.url);
      } catch {
        this.setStatus('disconnected');
        reject(new ConnectError('invalid_address', 'That device address is not valid.'));
        return;
      }
      this.ws = ws;
      let opened = false;

      const fail = (code: ConnectErrorCode, msg: string) => {
        clearTimeout(timer);
        this.pendingReject = null;
        reject(new ConnectError(code, msg));
      };
      this.pendingReject = (e) => fail(e instanceof ConnectError ? e.code : 'cancelled', e.message);

      const timer = setTimeout(() => {
        if (opened) return;
        this.detach(ws);
        if (this.ws === ws) this.ws = null;
        try {
          ws.close();
        } catch {
          /* ignore */
        }
        this.setStatus('disconnected');
        fail('timeout', "Couldn't reach MOTION-X (timed out).");
      }, this.connectTimeoutMs);

      ws.onopen = () => {
        opened = true;
        clearTimeout(timer);
        this.pendingReject = null;
        this.setStatus('connected');
        resolve();
      };
      ws.onmessage = (ev) => {
        if (typeof ev.data !== 'string') return;
        const parsed = parseDeviceMessage(ev.data);
        if (!parsed) return; // ignore anything that is not a valid state message
        this.state = parsed;
        this.lastStateAt = Date.now();
        this.stateListeners.forEach((l) => l(parsed));
      };
      ws.onerror = () => {
        /* a close event always follows */
      };
      ws.onclose = () => {
        this.detach(ws);
        if (this.ws === ws) this.ws = null;
        this.setStatus('disconnected');
        if (!opened) fail('unreachable', "Couldn't reach MOTION-X. Are you on its Wi-Fi?");
      };
    });
  }

  disconnect(): void {
    const ws = this.ws;
    this.ws = null;
    if (ws) {
      this.detach(ws);
      try {
        ws.close();
      } catch {
        /* ignore */
      }
    }
    this.pendingReject?.(new ConnectError('cancelled', 'Cancelled'));
    this.pendingReject = null;
    this.setStatus('disconnected');
  }

  send(command: Command): boolean {
    const ws = this.ws;
    if (!ws || ws.readyState !== OPEN) return false;
    try {
      ws.send(encodeCommand(command));
      return true;
    } catch {
      return false;
    }
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

  private detach(ws: SocketLike) {
    ws.onopen = ws.onclose = ws.onerror = null;
    ws.onmessage = null;
  }

  private setStatus(status: ConnectionStatus) {
    if (status === this.status) return;
    this.status = status;
    this.statusListeners.forEach((l) => l(status));
  }
}
