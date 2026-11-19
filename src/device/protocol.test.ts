import { describe, expect, it } from 'vitest';
import { encodeCommand, encodeState, parseCommand, parseDeviceMessage } from './protocol';

describe('parseDeviceMessage', () => {
  it('parses a full v1 state message', () => {
    const s = parseDeviceMessage(
      '{"type":"state","v":1,"level":1,"target_level":2,"running":true,"rpm":18.5,"current":0.9,"fault":null,"source":"app"}',
    );
    expect(s).toEqual({ level: 1, targetLevel: 2, running: true, rpm: 18.5, current: 0.9, fault: null, source: 'app' });
  });

  it('accepts the minimal brief format (no v, target_level, source)', () => {
    const s = parseDeviceMessage('{"type":"state","level":2,"running":true,"rpm":null,"current":null,"fault":null}');
    expect(s).toEqual({ level: 2, targetLevel: 2, running: true, rpm: null, current: null, fault: null, source: 'none' });
  });

  it('treats missing telemetry as null and empty fault as no fault', () => {
    const s = parseDeviceMessage('{"type":"state","level":0,"running":false,"fault":""}');
    expect(s?.rpm).toBeNull();
    expect(s?.current).toBeNull();
    expect(s?.fault).toBeNull();
  });

  it('keeps fault codes', () => {
    expect(parseDeviceMessage('{"type":"state","level":0,"running":false,"fault":"estop"}')?.fault).toBe('estop');
  });

  it.each([
    ['not json', 'hello'],
    ['array', '[1,2]'],
    ['null', 'null'],
    ['wrong type', '{"type":"log","level":0,"running":false}'],
    ['level out of range', '{"type":"state","level":4,"running":false}'],
    ['level as string', '{"type":"state","level":"1","running":false}'],
    ['running missing', '{"type":"state","level":1}'],
    ['rpm not a number', '{"type":"state","level":1,"running":true,"rpm":"fast"}'],
    ['rpm NaN-like', '{"type":"state","level":1,"running":true,"rpm":{}}'],
    ['bad target_level', '{"type":"state","level":1,"target_level":9,"running":true}'],
    ['fault not string', '{"type":"state","level":1,"running":true,"fault":3}'],
  ])('rejects %s', (_name, raw) => {
    expect(parseDeviceMessage(raw)).toBeNull();
  });
});

describe('commands', () => {
  it('round-trips every command', () => {
    for (const c of [
      { cmd: 'set_speed', level: 3 },
      { cmd: 'stop' },
      { cmd: 'estop' },
      { cmd: 'reset' },
      { cmd: 'ping' },
    ] as const) {
      expect(parseCommand(encodeCommand(c))).toEqual(c);
    }
  });

  it('encodes the exact wire format from the brief', () => {
    expect(encodeCommand({ cmd: 'set_speed', level: 2 })).toBe('{"cmd":"set_speed","level":2}');
  });

  it('rejects invalid commands', () => {
    expect(parseCommand('{"cmd":"set_speed","level":7}')).toBeNull();
    expect(parseCommand('{"cmd":"set_speed"}')).toBeNull();
    expect(parseCommand('{"cmd":"launch"}')).toBeNull();
    expect(parseCommand('garbage')).toBeNull();
  });
});

describe('encodeState', () => {
  it('produces snake_case wire format that parses back', () => {
    const state = { level: 1, targetLevel: 3, running: true, rpm: 15, current: null, fault: null, source: 'ir' } as const;
    const wire = JSON.parse(encodeState(state));
    expect(wire).toMatchObject({ type: 'state', v: 1, target_level: 3 });
    expect(parseDeviceMessage(encodeState(state))).toEqual(state);
  });
});
