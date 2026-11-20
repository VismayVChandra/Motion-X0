import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DeviceController } from '../device/controller';
import { SimDevice } from '../device/sim';
import { SessionRunner, type SessionResult } from './runner';

let ctrl: DeviceController;
let runner: SessionRunner;
let results: SessionResult[];

beforeEach(async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-01-01T09:00:00Z'));
  ctrl = new DeviceController(() => new SimDevice({ jitter: false }));
  const p = ctrl.connect();
  await vi.advanceTimersByTimeAsync(300);
  await p;
  results = [];
  runner = new SessionRunner(ctrl, (r) => results.push(r));
});

afterEach(() => {
  runner.dispose();
  ctrl.dispose();
  vi.useRealTimers();
});

describe('SessionRunner', () => {
  it('runs a full constant session end to end and stops the motor', async () => {
    expect(runner.start({ durationSec: 120, level: 2, pattern: 'constant' })).toBe(true);
    expect(ctrl.state.value?.targetLevel).toBe(2);

    await vi.advanceTimersByTimeAsync(60_000);
    expect(runner.status.value).toBe('running');
    expect(runner.remainingMs.value).toBeCloseTo(60_000, -3);
    expect(runner.progress.value).toBeCloseTo(0.5, 1);

    await vi.advanceTimersByTimeAsync(61_000);
    expect(runner.status.value).toBe('finished');
    expect(results).toHaveLength(1);
    const r = results[0];
    expect(r).toMatchObject({ plannedSec: 120, activeSec: 120, level: 2, pattern: 'constant', endReason: 'completed', mode: 'demo' });
    // 25 rpm for 2 min = 50 cycles, minus the gentle ramp-up at the start.
    expect(r.cycles).toBeGreaterThan(44);
    expect(r.cycles).toBeLessThanOrEqual(50);
    expect(ctrl.state.value?.targetLevel).toBe(0);
  });

  it('follows the warm-up pattern levels', async () => {
    runner.start({ durationSec: 300, level: 3, pattern: 'warmup' }); // warm-up 60 s at level 2
    await vi.advanceTimersByTimeAsync(30_000);
    expect(ctrl.state.value?.targetLevel).toBe(2);
    expect(runner.phase.value?.phase.name).toBe('Warm-up');
    await vi.advanceTimersByTimeAsync(60_000);
    expect(ctrl.state.value?.targetLevel).toBe(3);
    expect(runner.phase.value?.phase.name).toBe('Hold');
    await vi.advanceTimersByTimeAsync(180_000);
    expect(ctrl.state.value?.targetLevel).toBe(2);
    expect(runner.phase.value?.phase.name).toBe('Cool-down');
  });

  it('user pause stops the motor and freezes the timer; resume continues', async () => {
    runner.start({ durationSec: 120, level: 1, pattern: 'constant' });
    await vi.advanceTimersByTimeAsync(10_000);
    runner.pause();
    expect(runner.status.value).toBe('paused');
    expect(runner.pauseReason.value).toBe('user');
    const frozen = runner.activeMs.value;
    await vi.advanceTimersByTimeAsync(20_000);
    expect(runner.activeMs.value).toBe(frozen);
    expect(ctrl.state.value?.running).toBe(false);

    expect(runner.resume()).toBe(true);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(runner.activeMs.value).toBeGreaterThan(frozen + 4000);
    expect(ctrl.state.value?.running).toBe(true);
  });

  it('auto-pauses when the connection drops and resumes once it is back', async () => {
    runner.start({ durationSec: 300, level: 2, pattern: 'constant' });
    await vi.advanceTimersByTimeAsync(10_000);
    ctrl.setSimLinkDown(true);
    await vi.advanceTimersByTimeAsync(2_500);
    expect(runner.status.value).toBe('paused');
    expect(runner.pauseReason.value).toBe('connection');
    const frozen = runner.activeMs.value;
    expect(frozen).toBeLessThanOrEqual(12_500);

    expect(runner.resume()).toBe(false); // still offline
    ctrl.setSimLinkDown(false);
    await vi.advanceTimersByTimeAsync(600);
    expect(runner.resume()).toBe(true);
    await vi.advanceTimersByTimeAsync(3_000);
    expect(ctrl.state.value).toMatchObject({ running: true, fault: null });
  });

  it('auto-pauses when the IR remote stops the motor', async () => {
    runner.start({ durationSec: 300, level: 2, pattern: 'constant' });
    await vi.advanceTimersByTimeAsync(5_000);
    ctrl.sim()!.pressIr(0);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(runner.status.value).toBe('paused');
    expect(runner.pauseReason.value).toBe('device_stopped');
  });

  it('re-sends the level if the device target is changed by something else', async () => {
    runner.start({ durationSec: 300, level: 2, pattern: 'constant' });
    await vi.advanceTimersByTimeAsync(5_000);
    ctrl.sim()!.pressIr(3);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(ctrl.state.value?.targetLevel).toBe(2);
  });

  it('an emergency stop ends the session and is saved as such', async () => {
    runner.start({ durationSec: 300, level: 2, pattern: 'constant' });
    await vi.advanceTimersByTimeAsync(20_000);
    ctrl.emergencyStop();
    await vi.advanceTimersByTimeAsync(300);
    expect(runner.status.value).toBe('finished');
    expect(results[0]).toMatchObject({ endReason: 'estop' });
    expect(results[0].activeSec).toBeGreaterThanOrEqual(19);
    expect(ctrl.state.value?.fault).toBe('estop'); // reset stays with the user
  });

  it('ending early saves the partial session', async () => {
    runner.start({ durationSec: 600, level: 1, pattern: 'intervals' });
    await vi.advanceTimersByTimeAsync(90_000);
    runner.end();
    expect(results[0]).toMatchObject({ endReason: 'ended_early', plannedSec: 600, activeSec: 90 });
    expect(ctrl.state.value?.targetLevel).toBe(0);
  });

  it('will not start without a connection, during an e-stop, or twice', async () => {
    ctrl.emergencyStop();
    expect(runner.canStart()).toBe('estop');
    expect(runner.start({ durationSec: 120, level: 1, pattern: 'constant' })).toBe(false);
    ctrl.reset();
    expect(runner.start({ durationSec: 120, level: 1, pattern: 'constant' })).toBe(true);
    expect(runner.canStart()).toBe('already_running');
    runner.end();
    ctrl.disconnect();
    expect(runner.canStart()).toBe('not_connected');
  });

  it('does not count time the browser was asleep as exercise', async () => {
    runner.start({ durationSec: 600, level: 1, pattern: 'constant' });
    await vi.advanceTimersByTimeAsync(1_000);
    const before = runner.activeMs.value;
    vi.setSystemTime(Date.now() + 60_000); // clock jumps without timers firing
    await vi.advanceTimersByTimeAsync(250);
    expect(runner.activeMs.value - before).toBeLessThanOrEqual(1_000);
  });
});

describe('SessionRunner with a device that is still arming', () => {
  it('refuses to start while the ESC arms (esc_not_armed) and allows it afterwards', async () => {
    const { signal } = await import('@preact/signals');
    const state = signal<import('../device/types').DeviceState | null>({
      level: 0,
      targetLevel: 0,
      running: false,
      rpm: null,
      current: null,
      fault: 'esc_not_armed',
      source: 'none',
    });
    const fake = {
      state,
      link: signal<'connected'>('connected'),
      kind: signal<'real'>('real'),
      setLevel: vi.fn(() => true),
      stop: vi.fn(() => true),
    };
    const r = new SessionRunner(fake);
    expect(r.canStart()).toBe('not_ready');
    expect(r.start({ durationSec: 120, level: 1, pattern: 'constant' })).toBe(false);
    expect(fake.setLevel).not.toHaveBeenCalled();
    state.value = { ...state.value!, fault: null };
    expect(r.canStart()).toBeNull();
    r.dispose();
  });
});
