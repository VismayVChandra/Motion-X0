import { NOMINAL_RPM } from '../device/protocol';
import type { Level } from '../device/types';

export type SpeedLevel = 1 | 2 | 3;
export type PatternId = 'constant' | 'warmup' | 'intervals';

export const PATTERNS: Record<PatternId, { label: string; desc: string }> = {
  constant: { label: 'Constant', desc: 'Same speed the whole time' },
  warmup: { label: 'Warm-up → Hold → Cool-down', desc: 'Eases in and out gently' },
  intervals: { label: 'Intervals', desc: 'Short busy spells, then rest' },
};

export const PATTERN_IDS = Object.keys(PATTERNS) as PatternId[];

export interface Phase {
  name: 'Steady' | 'Warm-up' | 'Hold' | 'Cool-down' | 'Busy' | 'Rest';
  /** Seconds from session start (inclusive). */
  start: number;
  /** Seconds from session start (exclusive). */
  end: number;
  level: SpeedLevel;
}

/** Share of the session spent warming up and cooling down in the warm-up pattern. */
export const WARMUP_SHARE = 0.2;

/** Interval length: 30 s for sessions up to 5 min, otherwise 60 s. */
export const intervalLength = (durationSec: number) => (durationSec <= 300 ? 30 : 60);

/**
 * Turn a pattern into a list of timed phases. Lower phases use the next level down
 * (never below 1); the device ramps between levels, so changes are always gradual.
 */
export function buildSchedule(pattern: PatternId, durationSec: number, level: SpeedLevel): Phase[] {
  const d = Math.max(1, Math.round(durationSec));
  const easy = Math.max(1, level - 1) as SpeedLevel;

  if (pattern === 'warmup') {
    const edge = Math.max(1, Math.round(d * WARMUP_SHARE));
    if (d < 3) return [{ name: 'Hold', start: 0, end: d, level }];
    return [
      { name: 'Warm-up', start: 0, end: edge, level: easy },
      { name: 'Hold', start: edge, end: d - edge, level },
      { name: 'Cool-down', start: d - edge, end: d, level: easy },
    ];
  }

  if (pattern === 'intervals') {
    const len = intervalLength(d);
    const rest: SpeedLevel = 1;
    const phases: Phase[] = [];
    for (let t = 0, busy = true; t < d; t += len, busy = !busy) {
      phases.push({ name: busy ? 'Busy' : 'Rest', start: t, end: Math.min(d, t + len), level: busy ? level : rest });
    }
    return phases;
  }

  return [{ name: 'Steady', start: 0, end: d, level }];
}

/** Phase active at `t` seconds (the last phase once the session is over). */
export function phaseAt(schedule: Phase[], t: number): { phase: Phase; index: number } {
  const i = schedule.findIndex((p) => t >= p.start && t < p.end);
  const index = i === -1 ? (t < 0 ? 0 : schedule.length - 1) : i;
  return { phase: schedule[index], index };
}

/**
 * Pedal cycles turned in `dtMs`. Uses the measured rpm when a hall sensor is fitted,
 * otherwise the nominal rpm for the level the motor has reached.
 */
export function cyclesFor(rpm: number | null, level: Level, dtMs: number): number {
  const r = rpm ?? NOMINAL_RPM[level];
  return (Math.max(0, r) * Math.max(0, dtMs)) / 60000;
}
