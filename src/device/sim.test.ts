import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SimDevice } from './sim';
import type { DeviceState } from './types';

let sim: SimDevice;

async function connected(opts: ConstructorParameters<typeof SimDevice>[0] = {}) {
  sim = new SimDevice({ jitter: false, ...opts });
  const p = sim.connect();
  await vi.advanceTimersByTimeAsync(300);
  await p;
  return sim;
}

/** Advance time while sending heartbeats every 500 ms, like the app does during a session. */
async function runWithHeartbeat(ms: number) {
  for (let t = 0; t < ms; t += 500) {
    await vi.advanceTimersByTimeAsync(500);
    sim.send({ cmd: 'ping' });
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
});

afterEach(() => {
  sim?.dispose();
  vi.useRealTimers();
});

describe('SimDevice connection', () => {
  it('goes disconnected → connecting → connected and reports a state', async () => {
    sim = new SimDevice({ jitter: false });
    const statuses: string[] = [];
    sim.onStatus((s) => statuses.push(s));
    const p = sim.connect();
    expect(sim.getStatus()).toBe('connecting');
    await vi.advanceTimersByTimeAsync(300);
    await p;
    expect(statuses).toEqual(['connecting', 'connected']);
    expect(sim.getState()).not.toBeNull();
    expect(sim.getLastStateAt()).toBe(Date.now());
  });

  it('refuses to send while disconnected', () => {
    sim = new SimDevice({ jitter: false });
    expect(sim.send({ cmd: 'ping' })).toBe(false);
  });

  it('broadcasts state about once per second while idle', async () => {
    await connected();
    const seen: DeviceState[] = [];
    sim.onState((s) => seen.push(s));
    await vi.advanceTimersByTimeAsync(3000);
    expect(seen.length).toBeGreaterThanOrEqual(3);
    expect(seen.length).toBeLessThanOrEqual(4);
  });
});

describe('SimDevice safety rules', () => {
  it('boots stopped', async () => {
    await connected();
    expect(sim.getState()).toMatchObject({ level: 0, targetLevel: 0, running: false, fault: null });
  });

  it('ramps up smoothly and never jumps to full speed', async () => {
    await connected();
    sim.send({ cmd: 'set_speed', level: 3 });
    expect(sim.getState()).toMatchObject({ targetLevel: 3, level: 0 });

    const outputs: number[] = [];
    for (let i = 0; i < 50; i++) {
      await vi.advanceTimersByTimeAsync(100);
      if (i % 5 === 4) sim.send({ cmd: 'ping' });
      outputs.push(sim.getMotorOutput());
    }
    // No step bigger than ramp rate allows (0.25/s → 0.025 per 100 ms, small tolerance).
    for (let i = 1; i < outputs.length; i++) expect(outputs[i] - outputs[i - 1]).toBeLessThanOrEqual(0.026);
    // Not at full speed after 1 s, at full speed after 5 s.
    expect(outputs[9]).toBeLessThan(0.3);
    expect(outputs[outputs.length - 1]).toBeCloseTo(1);
    expect(sim.getState()).toMatchObject({ level: 3, running: true, rpm: 35 });
  });

  it('reports level steps while ramping (level lags target_level)', async () => {
    await connected();
    sim.send({ cmd: 'set_speed', level: 2 });
    await runWithHeartbeat(1500); // output 0.375 → reached level 1
    expect(sim.getState()).toMatchObject({ level: 1, targetLevel: 2 });
    await runWithHeartbeat(2000);
    expect(sim.getState()).toMatchObject({ level: 2, targetLevel: 2, rpm: 25 });
  });

  it('stop ramps down to zero', async () => {
    await connected();
    sim.send({ cmd: 'set_speed', level: 1 });
    await runWithHeartbeat(2000);
    sim.send({ cmd: 'stop' });
    expect(sim.getState()?.running).toBe(true); // still ramping down
    await runWithHeartbeat(1000);
    expect(sim.getState()).toMatchObject({ running: false, level: 0, fault: null });
  });

  it('estop cuts output immediately and latches until reset', async () => {
    await connected();
    sim.send({ cmd: 'set_speed', level: 2 });
    await runWithHeartbeat(3000);
    sim.send({ cmd: 'estop' });
    expect(sim.getMotorOutput()).toBe(0);
    expect(sim.getState()).toMatchObject({ running: false, fault: 'estop' });

    sim.send({ cmd: 'set_speed', level: 1 });
    await runWithHeartbeat(1000);
    expect(sim.getMotorOutput()).toBe(0); // ignored while latched

    sim.send({ cmd: 'reset' });
    expect(sim.getState()?.fault).toBeNull();
    expect(sim.getState()?.running).toBe(false); // reset never restarts the motor
  });

  it('stops the motor after 2 s without a heartbeat', async () => {
    await connected();
    sim.send({ cmd: 'set_speed', level: 1 });
    await runWithHeartbeat(1500);
    expect(sim.getState()?.running).toBe(true);

    await vi.advanceTimersByTimeAsync(2100); // app goes silent
    expect(sim.getState()?.fault).toBe('heartbeat_timeout');
    await vi.advanceTimersByTimeAsync(1000);
    expect(sim.getMotorOutput()).toBe(0);
  });

  it('a dropped link stops the motor and the app stops receiving state', async () => {
    await connected();
    sim.send({ cmd: 'set_speed', level: 2 });
    await runWithHeartbeat(2000);
    const lastBefore = sim.getLastStateAt()!;

    sim.setLinkDown(true);
    await runWithHeartbeat(4000); // app keeps pinging, but the pings are lost
    expect(sim.getLastStateAt()).toBe(lastBefore); // app sees silence → "connection lost"
    expect(sim.getMotorOutput()).toBe(0); // device stopped by itself

    sim.setLinkDown(false);
    expect(sim.getState()).toMatchObject({ running: false, fault: 'heartbeat_timeout' });

    // App comes back and asks again: fault clears and the motor ramps up.
    sim.send({ cmd: 'set_speed', level: 1 });
    expect(sim.getState()?.fault).toBeNull();
    await runWithHeartbeat(1000);
    expect(sim.getState()?.running).toBe(true);
  });

  it('keeps enforcing the timeout while the app is disconnected', async () => {
    await connected();
    sim.send({ cmd: 'set_speed', level: 1 });
    await runWithHeartbeat(1500);
    sim.disconnect();
    await vi.advanceTimersByTimeAsync(4000);
    expect(sim.getMotorOutput()).toBe(0);
  });

  it('IR remote works, is exempt from the app heartbeat, and IR 0 always stops', async () => {
    await connected();
    sim.pressIr(2);
    await vi.advanceTimersByTimeAsync(5000); // no app heartbeat at all
    expect(sim.getState()).toMatchObject({ running: true, level: 2, source: 'ir', fault: null });
    sim.pressIr(0);
    await vi.advanceTimersByTimeAsync(2000);
    expect(sim.getState()?.running).toBe(false);
  });

  it('IR cannot clear an estop latch', async () => {
    await connected();
    sim.send({ cmd: 'estop' });
    sim.pressIr(3);
    await vi.advanceTimersByTimeAsync(2000);
    expect(sim.getMotorOutput()).toBe(0);
  });

  it('reports null telemetry when sensors are absent', async () => {
    await connected({ rpmSensor: false, currentSensor: false });
    sim.send({ cmd: 'set_speed', level: 1 });
    await runWithHeartbeat(2000);
    expect(sim.getState()).toMatchObject({ running: true, rpm: null, current: null });
  });
});
