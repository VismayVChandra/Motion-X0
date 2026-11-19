import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DeviceController } from './controller';
import { FakeSocket } from './fakeSocket';
import { RealDevice } from './real';
import { SimDevice } from './sim';

let ctrl: DeviceController;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
  FakeSocket.instances = [];
});

afterEach(() => {
  ctrl?.dispose();
  vi.useRealTimers();
});

async function simController() {
  ctrl = new DeviceController(() => new SimDevice({ jitter: false }));
  const p = ctrl.connect();
  await vi.advanceTimersByTimeAsync(300);
  await p;
  return ctrl;
}

describe('DeviceController with SimDevice', () => {
  it('connects and receives state', async () => {
    await simController();
    expect(ctrl.link.value).toBe('connected');
    expect(ctrl.kind.value).toBe('sim');
    expect(ctrl.state.value).toMatchObject({ level: 0, running: false });
  });

  it('heartbeat keeps the motor running with no other commands', async () => {
    await simController();
    ctrl.start(2);
    await vi.advanceTimersByTimeAsync(15_000);
    expect(ctrl.link.value).toBe('connected');
    expect(ctrl.state.value).toMatchObject({ running: true, level: 2, fault: null });
    expect(ctrl.active.value).toBe(true);
  });

  it('a dropped link shows "lost" within ~2 s, the motor stops, and recovery works', async () => {
    await simController();
    ctrl.start(1);
    await vi.advanceTimersByTimeAsync(3000);
    expect(ctrl.state.value?.running).toBe(true);

    ctrl.setSimLinkDown(true);
    await vi.advanceTimersByTimeAsync(1900);
    expect(ctrl.link.value).toBe('connected');
    await vi.advanceTimersByTimeAsync(500);
    expect(ctrl.link.value).toBe('lost');
    expect(ctrl.sim()!.getMotorOutput()).toBeLessThan(1 / 3); // already ramping down
    await vi.advanceTimersByTimeAsync(2000);
    expect(ctrl.sim()!.getMotorOutput()).toBe(0);

    ctrl.setSimLinkDown(false);
    await vi.advanceTimersByTimeAsync(600);
    expect(ctrl.link.value).toBe('connected');
    expect(ctrl.state.value).toMatchObject({ running: false, fault: 'heartbeat_timeout' });

    ctrl.start(1); // starting again clears the timeout fault
    expect(ctrl.state.value?.fault).toBeNull();
  });

  it('emergency stop latches immediately; reset clears it without restarting', async () => {
    await simController();
    ctrl.start(3);
    await vi.advanceTimersByTimeAsync(5000);
    expect(ctrl.emergencyStop()).toBe(true);
    expect(ctrl.state.value).toMatchObject({ running: false, fault: 'estop' });
    expect(ctrl.active.value).toBe(false);
    ctrl.start(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(ctrl.state.value?.running).toBe(false);
    ctrl.reset();
    expect(ctrl.state.value).toMatchObject({ running: false, fault: null });
  });

  it('disconnect stops the motor first', async () => {
    await simController();
    ctrl.start(1);
    await vi.advanceTimersByTimeAsync(2000);
    const sim = ctrl.sim()!;
    ctrl.disconnect();
    expect(ctrl.link.value).toBe('idle');
    await vi.advanceTimersByTimeAsync(2000);
    expect(sim.getMotorOutput()).toBe(0);
  });

  it('reconfigure swaps the client and reconnects', async () => {
    let n = 0;
    ctrl = new DeviceController(() => {
      n++;
      return new SimDevice({ jitter: false });
    });
    const p = ctrl.connect();
    await vi.advanceTimersByTimeAsync(300);
    await p;
    ctrl.reconfigure();
    await vi.advanceTimersByTimeAsync(300);
    expect(n).toBe(2);
    expect(ctrl.link.value).toBe('connected');
  });
});

describe('DeviceController with RealDevice', () => {
  const STATE = '{"type":"state","level":0,"running":false,"rpm":null,"current":null,"fault":null}';

  function realController() {
    ctrl = new DeviceController(() => new RealDevice('ws://192.168.4.1/ws', (u) => new FakeSocket(u), 1000));
    void ctrl.connect();
  }

  it('keeps retrying with backoff while the device is unreachable', async () => {
    realController();
    expect(ctrl.link.value).toBe('connecting');
    FakeSocket.last().fail();
    await vi.advanceTimersByTimeAsync(0);
    expect(ctrl.attempt.value).toBe(1);
    expect(ctrl.error.value).toBe('unreachable');

    await vi.advanceTimersByTimeAsync(1000); // 1st retry
    expect(FakeSocket.instances).toHaveLength(2);
    FakeSocket.last().fail();
    await vi.advanceTimersByTimeAsync(1999);
    expect(FakeSocket.instances).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(1); // 2nd retry after 2 s
    expect(FakeSocket.instances).toHaveLength(3);

    FakeSocket.last().open();
    await vi.advanceTimersByTimeAsync(0);
    expect(ctrl.link.value).toBe('connected');
    expect(ctrl.attempt.value).toBe(0);
    expect(ctrl.error.value).toBeNull();
  });

  it('sends a heartbeat ping every 500 ms', async () => {
    realController();
    FakeSocket.last().open();
    await vi.advanceTimersByTimeAsync(0);
    const sock = FakeSocket.last();
    sock.sent = [];
    for (let i = 0; i < 4; i++) {
      await vi.advanceTimersByTimeAsync(500);
      sock.receive(STATE);
    }
    expect(sock.sent.filter((s) => s === '{"cmd":"ping"}')).toHaveLength(4);
  });

  it('goes "lost" when the socket closes, then reconnects', async () => {
    realController();
    FakeSocket.last().open();
    await vi.advanceTimersByTimeAsync(0);
    FakeSocket.last().receive(STATE);
    FakeSocket.last().close();
    expect(ctrl.link.value).toBe('lost');
    await vi.advanceTimersByTimeAsync(1000);
    FakeSocket.last().open();
    await vi.advanceTimersByTimeAsync(0);
    expect(ctrl.link.value).toBe('connected');
  });

  it('goes "lost" when an open socket falls silent, then forces a reconnect', async () => {
    realController();
    FakeSocket.last().open();
    await vi.advanceTimersByTimeAsync(0);
    FakeSocket.last().receive(STATE);
    await vi.advanceTimersByTimeAsync(2300);
    expect(ctrl.link.value).toBe('lost');
    expect(FakeSocket.instances).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(4000); // > 6 s silent → socket closed, retry scheduled
    await vi.advanceTimersByTimeAsync(1000);
    expect(FakeSocket.instances).toHaveLength(2);
  });

  it('retryNow skips the wait', async () => {
    realController();
    FakeSocket.last().fail();
    await vi.advanceTimersByTimeAsync(0);
    ctrl.retryNow();
    expect(FakeSocket.instances).toHaveLength(2);
  });
});
