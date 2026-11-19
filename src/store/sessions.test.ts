import { describe, expect, it } from 'vitest';
import type { SessionResult } from '../session/runner';
import { createSessionStore, isHighComfortScore, sanitizeRecord, SESSIONS_KEY } from './sessions';
import type { KeyValueStorage } from './settings';

function memoryStorage(initial: Record<string, string> = {}): KeyValueStorage {
  const data = { ...initial };
  return { getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v) };
}

const result = (over: Partial<SessionResult> = {}): SessionResult => ({
  startedAt: 1_700_000_000_000,
  endedAt: 1_700_000_600_000,
  plannedSec: 600,
  activeSec: 600,
  level: 2,
  pattern: 'warmup',
  cycles: 240,
  endReason: 'completed',
  mode: 'demo',
  ...over,
});

describe('session store', () => {
  it('saves a session and reloads it', () => {
    const storage = memoryStorage();
    const rec = createSessionStore(storage).add(result());
    expect(rec.id).toBeTruthy();
    expect(rec.comfort).toBeNull();
    const reloaded = createSessionStore(storage);
    expect(reloaded.sessions.value).toHaveLength(1);
    expect(reloaded.get(rec.id)).toMatchObject({ level: 2, cycles: 240, pattern: 'warmup' });
  });

  it('records the comfort score and note afterwards', () => {
    const storage = memoryStorage();
    const store = createSessionStore(storage);
    const rec = store.add(result());
    store.update(rec.id, { comfort: 8, note: 'stiff knee' });
    expect(createSessionStore(storage).get(rec.id)).toMatchObject({ comfort: 8, note: 'stiff knee' });
  });

  it('rejects out-of-range comfort scores', () => {
    const store = createSessionStore(memoryStorage());
    const rec = store.add(result());
    store.update(rec.id, { comfort: 11 });
    expect(store.get(rec.id)?.comfort).toBeNull();
    store.update(rec.id, { comfort: 4.5 });
    expect(store.get(rec.id)?.comfort).toBeNull();
  });

  it('keeps sessions oldest first and gives unique ids', () => {
    const store = createSessionStore(memoryStorage());
    const a = store.add(result({ startedAt: 2000 }));
    const b = store.add(result({ startedAt: 2000 }));
    expect(a.id).not.toBe(b.id);
    const storage = memoryStorage({
      [SESSIONS_KEY]: JSON.stringify([
        { ...result({ startedAt: 5 }), id: 'late' },
        { ...result({ startedAt: 1 }), id: 'early' },
      ]),
    });
    expect(createSessionStore(storage).sessions.value.map((s) => s.id)).toEqual(['early', 'late']);
  });

  it('survives corrupt storage and drops invalid records', () => {
    expect(createSessionStore(memoryStorage({ [SESSIONS_KEY]: '{bad' })).sessions.value).toEqual([]);
    const mixed = memoryStorage({
      [SESSIONS_KEY]: JSON.stringify([{ ...result(), id: 'ok' }, { id: 'bad', level: 9 }, 'junk', null]),
    });
    expect(createSessionStore(mixed).sessions.value.map((s) => s.id)).toEqual(['ok']);
  });

  it('works with no storage', () => {
    const store = createSessionStore(null);
    store.add(result());
    expect(store.sessions.value).toHaveLength(1);
  });
});

describe('sanitizeRecord', () => {
  it('fills safe defaults for optional fields', () => {
    const r = sanitizeRecord({ ...result(), id: 'x', pattern: 'zigzag', endReason: '??', mode: 'x', comfort: 0, note: 5 });
    expect(r).toMatchObject({ pattern: 'constant', endReason: 'ended_early', mode: 'demo', comfort: null, note: '' });
  });
});

describe('isHighComfortScore', () => {
  it('flags 7 and above', () => {
    expect(isHighComfortScore(6)).toBe(false);
    expect(isHighComfortScore(7)).toBe(true);
    expect(isHighComfortScore(10)).toBe(true);
    expect(isHighComfortScore(null)).toBe(false);
  });
});
