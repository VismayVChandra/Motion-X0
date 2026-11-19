import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeSocket } from './fakeSocket';
import { isMixedContent, RealDevice } from './real';
import { displayDeviceAddress, normalizeDeviceUrl } from './url';

const factory = (url: string) => new FakeSocket(url);
const STATE = { type: 'state', level: 1, running: true, rpm: 15, current: null, fault: null };

beforeEach(() => {
  FakeSocket.instances = [];
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

describe('RealDevice', () => {
  it('connects, reports status and parses state messages', async () => {
    const dev = new RealDevice('ws://192.168.4.1/ws', factory);
    const statuses: string[] = [];
    dev.onStatus((s) => statuses.push(s));
    const states: unknown[] = [];
    dev.onState((s) => states.push(s));

    const p = dev.connect();
    expect(FakeSocket.last().url).toBe('ws://192.168.4.1/ws');
    FakeSocket.last().open();
    await p;
    FakeSocket.last().receive(STATE);

    expect(statuses).toEqual(['connecting', 'connected']);
    expect(states).toHaveLength(1);
    expect(dev.getState()).toMatchObject({ level: 1, targetLevel: 1, running: true });
    expect(dev.getLastStateAt()).toBe(Date.now());
  });

  it('ignores invalid or non-state messages', async () => {
    const dev = new RealDevice('ws://x/ws', factory);
    const p = dev.connect();
    FakeSocket.last().open();
    await p;
    const seen = vi.fn();
    dev.onState(seen);
    FakeSocket.last().receive('not json');
    FakeSocket.last().receive({ type: 'state', level: 9, running: true });
    FakeSocket.last().receive({ type: 'hello' });
    expect(seen).not.toHaveBeenCalled();
    expect(dev.getLastStateAt()).toBeNull();
  });

  it('sends commands as protocol JSON only when open', async () => {
    const dev = new RealDevice('ws://x/ws', factory);
    expect(dev.send({ cmd: 'ping' })).toBe(false);
    const p = dev.connect();
    FakeSocket.last().open();
    await p;
    expect(dev.send({ cmd: 'set_speed', level: 2 })).toBe(true);
    expect(FakeSocket.last().sent).toEqual(['{"cmd":"set_speed","level":2}']);
  });

  it('rejects when the socket fails before opening', async () => {
    const dev = new RealDevice('ws://x/ws', factory);
    const p = dev.connect();
    FakeSocket.last().fail();
    await expect(p).rejects.toThrow(/Couldn't reach/);
    expect(dev.getStatus()).toBe('disconnected');
  });

  it('rejects after the connect timeout', async () => {
    const dev = new RealDevice('ws://x/ws', factory, 1000);
    const p = dev.connect();
    const assertion = expect(p).rejects.toThrow(/timed out/);
    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
    expect(dev.getStatus()).toBe('disconnected');
  });

  it('reports disconnected when an open socket closes', async () => {
    const dev = new RealDevice('ws://x/ws', factory);
    const p = dev.connect();
    FakeSocket.last().open();
    await p;
    FakeSocket.last().close();
    expect(dev.getStatus()).toBe('disconnected');
    expect(dev.send({ cmd: 'ping' })).toBe(false);
  });

  it('disconnect cancels a pending connect', async () => {
    const dev = new RealDevice('ws://x/ws', factory);
    const p = dev.connect();
    dev.disconnect();
    await expect(p).rejects.toThrow('Cancelled');
  });
});

describe('isMixedContent', () => {
  it('flags ws:// from an https page only', () => {
    expect(isMixedContent('ws://192.168.4.1/ws', 'https:')).toBe(true);
    expect(isMixedContent('ws://192.168.4.1/ws', 'http:')).toBe(false);
    expect(isMixedContent('wss://x/ws', 'https:')).toBe(false);
  });
});

describe('device address', () => {
  it.each([
    ['192.168.4.1', 'ws://192.168.4.1/ws'],
    [' 192.168.4.1 ', 'ws://192.168.4.1/ws'],
    ['192.168.4.1:81', 'ws://192.168.4.1:81/ws'],
    ['ws://10.0.0.5/ws', 'ws://10.0.0.5/ws'],
    ['ws://10.0.0.5/socket', 'ws://10.0.0.5/socket'],
    ['http://192.168.4.1', 'ws://192.168.4.1/ws'],
    ['wss://example.test/ws', 'wss://example.test/ws'],
  ])('normalizes %s', (input, expected) => {
    expect(normalizeDeviceUrl(input)).toBe(expected);
  });

  it.each(['', '   ', 'not a host', 'ws://'])('rejects %j', (input) => {
    expect(normalizeDeviceUrl(input)).toBeNull();
  });

  it('displays the short form for the default path', () => {
    expect(displayDeviceAddress('ws://192.168.4.1/ws')).toBe('192.168.4.1');
    expect(displayDeviceAddress('ws://10.0.0.5/socket')).toBe('ws://10.0.0.5/socket');
  });
});
