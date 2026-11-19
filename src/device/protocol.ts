import type { Command, ControlSource, DeviceState, Level } from './types';

export const PROTOCOL_VERSION = 1;
export const DEFAULT_DEVICE_URL = 'ws://192.168.4.1/ws';

/** App sends a heartbeat this often while a session runs. */
export const HEARTBEAT_INTERVAL_MS = 500;
/** Device stops the motor after this much silence; app shows "connection lost" after the same. */
export const HEARTBEAT_TIMEOUT_MS = 2000;

/** Nominal crank rpm per level. Simulator model and cycle-count fallback when rpm is null. */
export const NOMINAL_RPM: Readonly<Record<Level, number>> = { 0: 0, 1: 15, 2: 25, 3: 35 };

export function isLevel(value: unknown): value is Level {
  return value === 0 || value === 1 || value === 2 || value === 3;
}

export function encodeCommand(command: Command): string {
  return JSON.stringify(command);
}

function tryParse(raw: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(raw);
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/** Device-side parsing (used by SimDevice; mirrors the firmware). Returns null for invalid input. */
export function parseCommand(raw: string): Command | null {
  const msg = tryParse(raw);
  if (!msg) return null;
  switch (msg.cmd) {
    case 'set_speed':
      return isLevel(msg.level) ? { cmd: 'set_speed', level: msg.level } : null;
    case 'stop':
    case 'estop':
    case 'reset':
    case 'ping':
      return { cmd: msg.cmd };
    default:
      return null;
  }
}

function numberOrNull(value: unknown): number | null | undefined {
  if (value === null) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return undefined; // invalid
}

function isSource(value: unknown): value is ControlSource {
  return value === 'app' || value === 'ir' || value === 'none';
}

/**
 * Parse a device → app message. Returns null for anything that is not a valid `state`.
 * Optional v1 fields (`v`, `target_level`, `source`) may be missing for simpler firmware.
 */
export function parseDeviceMessage(raw: string): DeviceState | null {
  const msg = tryParse(raw);
  if (!msg || msg.type !== 'state') return null;
  if (!isLevel(msg.level) || typeof msg.running !== 'boolean') return null;

  const rpm = numberOrNull(msg.rpm ?? null);
  const current = numberOrNull(msg.current ?? null);
  if (rpm === undefined || current === undefined) return null;

  const fault = msg.fault ?? null;
  if (fault !== null && typeof fault !== 'string') return null;

  let targetLevel: Level = msg.level;
  if (msg.target_level !== undefined) {
    if (!isLevel(msg.target_level)) return null;
    targetLevel = msg.target_level;
  }

  return {
    level: msg.level,
    targetLevel,
    running: msg.running,
    rpm,
    current,
    fault: fault === '' ? null : fault,
    source: isSource(msg.source) ? msg.source : 'none',
  };
}

/** Device-side encoding (used by SimDevice; mirrors the firmware). */
export function encodeState(state: DeviceState): string {
  return JSON.stringify({
    type: 'state',
    v: PROTOCOL_VERSION,
    level: state.level,
    target_level: state.targetLevel,
    running: state.running,
    rpm: state.rpm,
    current: state.current,
    fault: state.fault,
    source: state.source,
  });
}
