import { HEARTBEAT_TIMEOUT_MS, NOMINAL_RPM } from './protocol';
import type { Command, ControlSource, DeviceState, FaultCode, Level } from './types';

/** Max output change per second when speeding up (stopped → full takes ≥ 4 s). */
export const RAMP_UP_PER_S = 0.25;
/** Max output change per second when slowing down or stopping. */
export const RAMP_DOWN_PER_S = 0.5;
/** Internal integration step, so long gaps between ticks still apply rules in order. */
const STEP_MS = 50;
const EPS = 1e-6;

export interface MotorModelOptions {
  /** Simulate a hall sensor (rpm) being fitted. Default true. */
  rpmSensor?: boolean;
  /** Simulate an INA219 (current) being fitted. Default true. */
  currentSensor?: boolean;
}

const outputFor = (level: Level) => level / 3;

/**
 * Pure model of the firmware safety rules (docs/protocol.md). Time is passed in, so it is
 * deterministic and testable. The ESP32 sketch implements the same rules.
 */
export class MotorModel {
  private output = 0; // 0..1 motor output
  private target: Level = 0;
  private fault: FaultCode | null = null;
  private source: ControlSource = 'none';
  private lastAppMsgAt: number;
  private lastTickAt: number;
  private readonly rpmSensor: boolean;
  private readonly currentSensor: boolean;

  constructor(now: number, options: MotorModelOptions = {}) {
    // Boots stopped.
    this.lastAppMsgAt = now;
    this.lastTickAt = now;
    this.rpmSensor = options.rpmSensor ?? true;
    this.currentSensor = options.currentSensor ?? true;
  }

  /** Apply a command. `source` is 'app' for WebSocket commands, 'ir' for the remote. */
  command(cmd: Command, now: number, source: 'app' | 'ir' = 'app'): void {
    this.tick(now);
    if (source === 'app') this.lastAppMsgAt = now; // every valid app message is a heartbeat

    switch (cmd.cmd) {
      case 'ping':
        return;
      case 'estop':
        this.output = 0;
        this.target = 0;
        this.fault = 'estop';
        return;
      case 'stop':
        this.target = 0;
        return;
      case 'reset':
        if (this.output <= EPS && this.fault !== null) this.fault = null;
        return;
      case 'set_speed': {
        if (cmd.level === 0) {
          this.target = 0;
          return;
        }
        if (this.fault === 'estop') return; // latched until reset
        // A deliberate new speed request (app back online, or the IR remote at the machine)
        // clears a heartbeat timeout. The e-stop latch above is never cleared this way.
        if (this.fault === 'heartbeat_timeout') this.fault = null;
        if (this.fault !== null) return;
        this.target = cmd.level;
        this.source = source;
        return;
      }
    }
  }

  /** Advance time to `now`, applying ramps and the heartbeat timeout in small steps. */
  tick(now: number): void {
    while (this.lastTickAt < now) {
      const dt = Math.min(STEP_MS, now - this.lastTickAt);
      this.lastTickAt += dt;
      this.step(dt, this.lastTickAt);
    }
  }

  private step(dtMs: number, at: number): void {
    const active = this.output > EPS || this.target > 0;
    if (this.source === 'app' && active && this.fault === null && at - this.lastAppMsgAt > HEARTBEAT_TIMEOUT_MS) {
      this.target = 0;
      this.fault = 'heartbeat_timeout';
    }
    const goal = outputFor(this.target);
    if (this.output < goal) {
      this.output = Math.min(goal, this.output + (RAMP_UP_PER_S * dtMs) / 1000);
    } else if (this.output > goal) {
      this.output = Math.max(goal, this.output - (RAMP_DOWN_PER_S * dtMs) / 1000);
    }
    if (this.output <= EPS) this.output = 0;
  }

  /** Level actually reached: rounds toward where the output came from while ramping. */
  private reachedLevel(): Level {
    const scaled = this.output * 3;
    const goal = outputFor(this.target);
    const lvl = this.output >= goal ? Math.ceil(scaled - EPS) : Math.floor(scaled + EPS);
    return Math.max(0, Math.min(3, lvl)) as Level;
  }

  /** Piecewise-linear rpm between the nominal per-level values. */
  private rpm(): number {
    const scaled = this.output * 3;
    const lo = Math.min(2, Math.floor(scaled)) as Level;
    const hi = (lo + 1) as Level;
    const frac = scaled - lo;
    return NOMINAL_RPM[lo] + (NOMINAL_RPM[hi] - NOMINAL_RPM[lo]) * frac;
  }

  getOutput(): number {
    return this.output;
  }

  getState(): DeviceState {
    const running = this.output > EPS;
    return {
      level: this.reachedLevel(),
      targetLevel: this.target,
      running,
      rpm: this.rpmSensor ? Math.round(this.rpm() * 10) / 10 : null,
      current: this.currentSensor ? Math.round((running ? 0.3 + this.output * 1.5 : 0.05) * 100) / 100 : null,
      fault: this.fault,
      source: this.source,
    };
  }
}
