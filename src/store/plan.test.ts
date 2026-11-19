import { describe, expect, it, vi } from 'vitest';
import { createPlanStore, PLAN_KEY, sanitizePlan } from './plan';
import type { KeyValueStorage } from './settings';

function memoryStorage(initial: Record<string, string> = {}): KeyValueStorage {
  const data = { ...initial };
  return { getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v) };
}

const input = { patientName: ' Asha Verma ', level: 2 as const, durationMin: 10, sessionsPerDay: 3, note: 'Keep to level 2' };

describe('plan store', () => {
  it('starts with no plan', () => {
    expect(createPlanStore(memoryStorage()).plan.value).toBeNull();
  });

  it('saves, trims and reloads a plan', () => {
    const storage = memoryStorage();
    expect(createPlanStore(storage).save(input)).toBe(true);
    expect(createPlanStore(storage).plan.value).toMatchObject({ patientName: 'Asha Verma', level: 2, durationMin: 10, sessionsPerDay: 3 });
  });

  it('keeps the original start date when the plan is edited', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    const store = createPlanStore(memoryStorage());
    store.save(input);
    vi.setSystemTime(9_000_000);
    store.save({ ...input, level: 3 });
    expect(store.plan.value).toMatchObject({ level: 3, startedAt: 1_000_000, updatedAt: 9_000_000 });
    vi.useRealTimers();
  });

  it('rejects a plan without a name', () => {
    const store = createPlanStore(memoryStorage());
    expect(store.save({ ...input, patientName: '   ' })).toBe(false);
    expect(store.plan.value).toBeNull();
  });

  it('clamps sessions per day and falls back for unknown durations', () => {
    expect(sanitizePlan({ ...input, sessionsPerDay: 40, durationMin: 7 })).toMatchObject({ sessionsPerDay: 6, durationMin: 10 });
    expect(sanitizePlan({ ...input, sessionsPerDay: 0 })?.sessionsPerDay).toBe(1);
    expect(sanitizePlan({ ...input, level: 5 })).toBeNull();
  });

  it('survives corrupt storage and can be cleared', () => {
    expect(createPlanStore(memoryStorage({ [PLAN_KEY]: '{x' })).plan.value).toBeNull();
    const storage = memoryStorage();
    const store = createPlanStore(storage);
    store.save(input);
    store.clear();
    expect(createPlanStore(storage).plan.value).toBeNull();
  });
});
