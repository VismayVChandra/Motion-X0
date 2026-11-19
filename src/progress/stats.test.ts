import { describe, expect, it } from 'vitest';
import type { Plan } from '../store/plan';
import type { SessionRecord } from '../store/sessions';
import {
  addDays,
  averageComfort,
  comfortTrend,
  countsTowardPlan,
  dailyMinutes,
  dayKey,
  startOfWeek,
  streaks,
  todayProgress,
  weeklyAdherence,
} from './stats';

// Friday 20 Nov 2026, 15:00 local time (week started Monday 16 Nov).
const NOW = new Date(2026, 10, 20, 15, 0).getTime();
const at = (daysAgo: number, hour = 9) => {
  const d = new Date(addDays(NOW, -daysAgo));
  d.setHours(hour, 0, 0, 0);
  return d.getTime();
};

let n = 0;
const session = (daysAgo: number, mins = 10, over: Partial<SessionRecord> = {}): SessionRecord => ({
  id: `s${n++}`,
  startedAt: at(daysAgo, 8 + (n % 10)),
  endedAt: at(daysAgo, 9),
  plannedSec: mins * 60,
  activeSec: mins * 60,
  level: 2,
  pattern: 'constant',
  cycles: mins * 25,
  endReason: 'completed',
  mode: 'demo',
  comfort: null,
  note: '',
  ...over,
});

const plan = (over: Partial<Plan> = {}): Plan => ({
  patientName: 'Asha',
  level: 2,
  durationMin: 10,
  sessionsPerDay: 2,
  note: '',
  startedAt: at(13),
  updatedAt: at(13),
  ...over,
});

describe('dates', () => {
  it('dayKey uses local dates', () => {
    expect(dayKey(NOW)).toBe('2026-11-20');
    expect(dayKey(addDays(NOW, -20))).toBe('2026-10-31');
  });
  it('weeks start on Monday', () => {
    expect(new Date(startOfWeek(NOW)).getDay()).toBe(1);
    expect(dayKey(startOfWeek(NOW))).toBe('2026-11-16');
  });
});

describe('countsTowardPlan', () => {
  it('needs at least 80 % of the prescribed time', () => {
    expect(countsTowardPlan(session(0, 8), plan())).toBe(true);
    expect(countsTowardPlan(session(0, 7.9), plan())).toBe(false);
    expect(countsTowardPlan(session(0, 20), plan())).toBe(true);
  });
});

describe('todayProgress', () => {
  it('counts only qualifying sessions today against the plan', () => {
    const s = [session(0, 10), session(0, 3), session(1, 10)];
    expect(todayProgress(s, plan(), NOW)).toEqual({ done: 1, target: 2, complete: false, minutes: 13 });
  });
  it('is complete once the daily target is met', () => {
    expect(todayProgress([session(0), session(0)], plan(), NOW).complete).toBe(true);
  });
  it('without a plan counts every session and has no target', () => {
    expect(todayProgress([session(0, 3)], null, NOW)).toMatchObject({ done: 1, target: 0, complete: false });
  });
});

describe('dailyMinutes', () => {
  it('returns one bar per day, oldest first, today last', () => {
    const bars = dailyMinutes([session(0, 10), session(0, 5), session(2, 20), session(9, 10)], 7, NOW);
    expect(bars).toHaveLength(7);
    expect(bars.map((b) => b.minutes)).toEqual([0, 0, 0, 0, 20, 0, 15]);
    expect(bars[6].isToday).toBe(true);
    expect(bars[0].key).toBe('2026-11-14');
  });
  it('labels 30-day bars with the day of the month', () => {
    const bars = dailyMinutes([], 30, NOW);
    expect(bars[29].label).toBe('20');
  });
});

describe('weeklyAdherence', () => {
  it('counts only days since the plan started and up to today', () => {
    // Plan started Wednesday (2 days ago): Wed, Thu, Fri → 3 days × 2 = 6 planned.
    const p = plan({ startedAt: at(2) });
    const s = [session(2), session(2), session(1), session(0)];
    const [week] = weeklyAdherence(s, p, 1, NOW);
    expect(week).toMatchObject({ planned: 6, done: 4, pct: 67 });
  });

  it('extra sessions do not push adherence over 100 %', () => {
    const p = plan({ startedAt: at(0), sessionsPerDay: 1 });
    const [week] = weeklyAdherence([session(0), session(0), session(0)], p, 1, NOW);
    expect(week.pct).toBe(100);
  });

  it('short sessions do not count', () => {
    const p = plan({ startedAt: at(0), sessionsPerDay: 1 });
    expect(weeklyAdherence([session(0, 2)], p, 1, NOW)[0].pct).toBe(0);
  });

  it('weeks before the plan have no adherence value', () => {
    const p = plan({ startedAt: at(2) });
    const weeks = weeklyAdherence([], p, 3, NOW);
    expect(weeks.map((w) => w.pct)).toEqual([null, null, 0]);
    expect(weeks).toHaveLength(3);
  });

  it('a full past week is 7 × sessions per day', () => {
    const p = plan({ startedAt: at(30), sessionsPerDay: 1 });
    const s = [5, 6, 7, 8, 9, 10, 11].map((d) => session(d));
    const weeks = weeklyAdherence(s, p, 2, NOW);
    expect(weeks[0]).toMatchObject({ planned: 7, done: 7, pct: 100 }); // Mon 9 – Sun 15 Nov
  });
});

describe('streaks', () => {
  it('counts consecutive days meeting the target', () => {
    const p = plan({ sessionsPerDay: 1 });
    const s = [session(0), session(1), session(2), session(4), session(5), session(6), session(7)];
    expect(streaks(s, p, NOW)).toEqual({ current: 3, best: 4 });
  });

  it('an unfinished today does not break the streak', () => {
    const p = plan({ sessionsPerDay: 1 });
    expect(streaks([session(1), session(2)], p, NOW).current).toBe(2);
  });

  it('a missed yesterday resets the current streak', () => {
    const p = plan({ sessionsPerDay: 1 });
    expect(streaks([session(2), session(3)], p, NOW)).toEqual({ current: 0, best: 2 });
  });

  it('days below the daily target do not count', () => {
    const p = plan({ sessionsPerDay: 2 });
    expect(streaks([session(0), session(1), session(1)], p, NOW)).toEqual({ current: 1, best: 1 });
  });

  it('without a plan any session counts; empty history is zero', () => {
    expect(streaks([session(0, 2), session(1, 2)], null, NOW).current).toBe(2);
    expect(streaks([], null, NOW)).toEqual({ current: 0, best: 0 });
  });
});

describe('comfort', () => {
  const s = [
    session(5, 10, { comfort: 3 }),
    session(4, 10),
    session(3, 10, { comfort: 8 }),
    session(1, 10, { comfort: 4 }),
  ];
  it('trend skips unscored sessions and keeps the last n, oldest first', () => {
    expect(comfortTrend(s).map((p) => p.value)).toEqual([3, 8, 4]);
    expect(comfortTrend(s, 2).map((p) => p.value)).toEqual([8, 4]);
  });
  it('average since a date', () => {
    expect(averageComfort(s, at(3, 0))).toBe(6);
    expect(averageComfort(s, at(0, 0))).toBeNull();
  });
});
