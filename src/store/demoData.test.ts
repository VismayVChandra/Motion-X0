import { describe, expect, it } from 'vitest';
import { streaks, todayProgress, weeklyAdherence } from '../progress/stats';
import { canPersist } from './storageCheck';
import { makeSampleData } from './demoData';
import { createPlanStore } from './plan';
import { createSessionStore, sanitizeRecord } from './sessions';

const NOW = new Date(2026, 10, 20, 12, 0).getTime();

describe('sample data', () => {
  const { plan, sessions } = makeSampleData(NOW);

  it('every sample session is a valid record in the past', () => {
    for (const s of sessions) {
      expect(sanitizeRecord(s)).toEqual(s);
      expect(s.endedAt).toBeLessThan(NOW);
    }
  });

  it('tells a believable story: good streak, nothing done yet today, one high score', () => {
    expect(streaks(sessions, plan, NOW).current).toBe(3);
    expect(todayProgress(sessions, plan, NOW)).toMatchObject({ done: 0, target: 2 });
    expect(sessions.filter((s) => (s.comfort ?? 0) >= 7)).toHaveLength(1);
    const weeks = weeklyAdherence(sessions, plan, 2, NOW);
    expect(weeks[0].pct).toBeGreaterThan(50);
  });

  it('loads into the stores and can be cleared', () => {
    const sStore = createSessionStore(null);
    const pStore = createPlanStore(null);
    sStore.replaceAll(sessions);
    expect(pStore.restore(plan)).toBe(true);
    expect(sStore.sessions.value).toHaveLength(sessions.length);
    expect(pStore.plan.value?.startedAt).toBe(plan.startedAt);
    sStore.clear();
    pStore.clear();
    expect(sStore.sessions.value).toEqual([]);
    expect(pStore.plan.value).toBeNull();
  });
});

describe('canPersist', () => {
  it('detects working and blocked storage', () => {
    const data: Record<string, string> = {};
    expect(canPersist({ setItem: (k, v) => void (data[k] = v), removeItem: (k) => void delete data[k] })).toBe(true);
    expect(
      canPersist({
        setItem: () => {
          throw new Error('QuotaExceeded');
        },
        removeItem: () => {},
      }),
    ).toBe(false);
    expect(canPersist(null)).toBe(false);
  });
});
