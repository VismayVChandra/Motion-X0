import { describe, expect, it } from 'vitest';
import { buildSchedule, cyclesFor, phaseAt, type Phase } from './patterns';

/** Phases must cover [0, d) exactly, with no gaps or overlaps. */
function expectContiguous(phases: Phase[], d: number) {
  expect(phases[0].start).toBe(0);
  expect(phases[phases.length - 1].end).toBe(d);
  for (let i = 1; i < phases.length; i++) expect(phases[i].start).toBe(phases[i - 1].end);
  for (const p of phases) expect(p.end).toBeGreaterThan(p.start);
}

describe('buildSchedule', () => {
  it('constant: one phase at the chosen level', () => {
    expect(buildSchedule('constant', 600, 2)).toEqual([{ name: 'Steady', start: 0, end: 600, level: 2 }]);
  });

  it('warm-up: 20 % warm-up and cool-down one level lower', () => {
    const s = buildSchedule('warmup', 600, 3);
    expect(s.map((p) => [p.name, p.start, p.end, p.level])).toEqual([
      ['Warm-up', 0, 120, 2],
      ['Hold', 120, 480, 3],
      ['Cool-down', 480, 600, 2],
    ]);
  });

  it('warm-up never goes below level 1', () => {
    expect(buildSchedule('warmup', 600, 1).every((p) => p.level === 1)).toBe(true);
  });

  it('intervals: 30 s spells for short sessions, alternating busy and rest', () => {
    const s = buildSchedule('intervals', 120, 3);
    expect(s.map((p) => [p.name, p.level])).toEqual([
      ['Busy', 3],
      ['Rest', 1],
      ['Busy', 3],
      ['Rest', 1],
    ]);
    expectContiguous(s, 120);
  });

  it('intervals: 60 s spells for longer sessions, last one truncated', () => {
    const s = buildSchedule('intervals', 630, 2);
    expect(s).toHaveLength(11);
    expect(s[10]).toMatchObject({ start: 600, end: 630, name: 'Busy' });
    expectContiguous(s, 630);
  });

  it.each(['constant', 'warmup', 'intervals'] as const)('%s covers every duration option without gaps', (p) => {
    for (const min of [2, 5, 10, 15, 20]) expectContiguous(buildSchedule(p, min * 60, 2), min * 60);
  });
});

describe('phaseAt', () => {
  const s = buildSchedule('warmup', 600, 2);
  it('finds the active phase', () => {
    expect(phaseAt(s, 0).phase.name).toBe('Warm-up');
    expect(phaseAt(s, 119.9).phase.name).toBe('Warm-up');
    expect(phaseAt(s, 120).phase.name).toBe('Hold');
    expect(phaseAt(s, 599).index).toBe(2);
  });
  it('clamps outside the session', () => {
    expect(phaseAt(s, -5).index).toBe(0);
    expect(phaseAt(s, 9999).index).toBe(2);
  });
});

describe('cyclesFor', () => {
  it('uses measured rpm', () => {
    expect(cyclesFor(30, 2, 60_000)).toBe(30);
    expect(cyclesFor(24, 1, 500)).toBeCloseTo(0.2);
  });
  it('falls back to nominal rpm per level when there is no sensor', () => {
    expect(cyclesFor(null, 2, 60_000)).toBe(25);
    expect(cyclesFor(null, 0, 60_000)).toBe(0);
  });
  it('ignores negative inputs', () => {
    expect(cyclesFor(-5, 1, 1000)).toBe(0);
    expect(cyclesFor(20, 1, -1000)).toBe(0);
  });
});
