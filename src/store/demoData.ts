import { addDays } from '../progress/stats';
import type { Plan } from './plan';
import type { SessionRecord } from './sessions';

/**
 * Realistic sample history for demos: a plan started 12 days ago (level 2, 10 min,
 * twice a day) and ~2 weeks of sessions with mostly good adherence, one short session,
 * one missed day and one high comfort score. Clearly marked as Demo mode recordings.
 */
export function makeSampleData(now = Date.now(), patientName = 'Asha Verma'): { plan: Plan; sessions: SessionRecord[] } {
  const at = (daysAgo: number, hour: number) => {
    const d = new Date(addDays(now, -daysAgo));
    d.setHours(hour, hour === 9 ? 10 : 5, 0, 0);
    return d.getTime();
  };
  // [days ago, hour, minutes done, comfort, note]
  const rows: [number, number, number, number, string][] = [
    [11, 9, 10, 4, ''],
    [11, 18, 10, 3, ''],
    [10, 9, 10, 4, ''],
    [9, 9, 10, 3, ''],
    [9, 18, 10, 4, ''],
    [8, 9, 10, 5, ''],
    [8, 18, 10, 4, ''],
    // day 7: missed
    [6, 9, 10, 4, ''],
    [6, 18, 10, 5, ''],
    [5, 9, 10, 8, 'Knee felt tight near the end'],
    [4, 9, 6, 5, 'Stopped early, tired'],
    [3, 9, 10, 4, ''],
    [3, 18, 10, 3, ''],
    [2, 9, 10, 3, ''],
    [2, 18, 10, 4, ''],
    [1, 9, 10, 3, ''],
    [1, 18, 10, 2, 'Felt easy today'],
  ];
  const sessions: SessionRecord[] = rows.map(([d, h, mins, comfort, note], i) => {
    const startedAt = at(d, h);
    return {
      id: `sample-${i}`,
      startedAt,
      endedAt: startedAt + mins * 60_000 + 20_000,
      plannedSec: 600,
      activeSec: mins * 60,
      level: 2,
      pattern: i % 3 === 0 ? 'constant' : 'warmup',
      cycles: Math.round(mins * 23.5),
      endReason: mins >= 10 ? 'completed' : 'ended_early',
      mode: 'demo',
      comfort,
      note,
    };
  });
  const started = at(12, 8);
  const plan: Plan = {
    patientName,
    level: 2,
    durationMin: 10,
    sessionsPerDay: 2,
    note: 'Keep to level 2 this week. Stop if anything feels uncomfortable.',
    startedAt: started,
    updatedAt: started,
  };
  return { plan, sessions };
}
