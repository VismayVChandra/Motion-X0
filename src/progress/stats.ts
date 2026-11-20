import type { Plan } from '../store/plan';
import type { SessionRecord } from '../store/sessions';

/** A session counts toward the plan if it lasted at least this share of the prescribed time. */
export const COUNT_THRESHOLD = 0.8;
const DAY_MS = 86_400_000;

// ---------- dates (local time) ----------

export function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Local midnight `n` days after the day containing `ts` (DST-safe). */
export function addDays(ts: number, n: number): number {
  const d = new Date(startOfDay(ts));
  d.setDate(d.getDate() + n);
  return d.getTime();
}

export function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Monday 00:00 of the week containing `ts`. */
export function startOfWeek(ts: number): number {
  const d = new Date(startOfDay(ts));
  const offset = (d.getDay() + 6) % 7; // Mon = 0
  return addDays(d.getTime(), -offset);
}

const daysBetween = (a: number, b: number) => Math.round((startOfDay(b) - startOfDay(a)) / DAY_MS);

// ---------- per-day counting ----------

export function countsTowardPlan(s: SessionRecord, plan: Plan): boolean {
  return s.activeSec >= COUNT_THRESHOLD * plan.durationMin * 60;
}

export function sessionsByDay(sessions: SessionRecord[]): Map<string, SessionRecord[]> {
  const map = new Map<string, SessionRecord[]>();
  for (const s of sessions) {
    const k = dayKey(s.startedAt);
    const list = map.get(k);
    if (list) list.push(s);
    else map.set(k, [s]);
  }
  return map;
}

/** Sessions done on a day: with a plan, only those long enough to count. */
export function doneOnDay(daySessions: SessionRecord[] | undefined, plan: Plan | null): number {
  if (!daySessions) return 0;
  return plan ? daySessions.filter((s) => countsTowardPlan(s, plan)).length : daySessions.length;
}

export interface TodayProgress {
  done: number;
  /** Sessions prescribed per day (0 without a plan). */
  target: number;
  complete: boolean;
  minutes: number;
}

export function todayProgress(sessions: SessionRecord[], plan: Plan | null, now = Date.now()): TodayProgress {
  const today = sessionsByDay(sessions).get(dayKey(now));
  const done = doneOnDay(today, plan);
  const target = plan?.sessionsPerDay ?? 0;
  const minutes = Math.round((today ?? []).reduce((sum, s) => sum + s.activeSec, 0) / 60);
  return { done, target, complete: target > 0 && done >= target, minutes };
}

// ---------- chart data ----------

export interface DayBar {
  key: string;
  ts: number;
  label: string;
  minutes: number;
  isToday: boolean;
}

/** Exercise minutes per day for the last `days` days, oldest first. */
export function dailyMinutes(sessions: SessionRecord[], days: number, now = Date.now()): DayBar[] {
  const byDay = sessionsByDay(sessions);
  const out: DayBar[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const ts = addDays(now, -i);
    const key = dayKey(ts);
    const secs = (byDay.get(key) ?? []).reduce((sum, s) => sum + s.activeSec, 0);
    const d = new Date(ts);
    out.push({
      key,
      ts,
      label: days <= 7 ? d.toLocaleDateString([], { weekday: 'narrow' }) : String(d.getDate()),
      minutes: Math.round((secs / 60) * 10) / 10,
      isToday: i === 0,
    });
  }
  return out;
}

export interface WeekAdherence {
  weekStart: number;
  label: string;
  done: number;
  planned: number;
  /** 0–100, or null if the plan did not cover any day of that week. */
  pct: number | null;
}

/**
 * Plan adherence per week (Monday start), oldest first. Only days from the plan's start up
 * to today count. Extra sessions beyond the daily target do not raise adherence above 100 %.
 */
export function weeklyAdherence(sessions: SessionRecord[], plan: Plan, weeks: number, now = Date.now()): WeekAdherence[] {
  const byDay = sessionsByDay(sessions);
  const planStart = startOfDay(plan.startedAt);
  const today = startOfDay(now);
  const out: WeekAdherence[] = [];
  const thisWeek = startOfWeek(now);
  for (let w = weeks - 1; w >= 0; w--) {
    const weekStart = addDays(thisWeek, -7 * w);
    let done = 0;
    let planned = 0;
    for (let d = 0; d < 7; d++) {
      const day = addDays(weekStart, d);
      if (day < planStart || day > today) continue;
      const doneThatDay = Math.min(plan.sessionsPerDay, doneOnDay(byDay.get(dayKey(day)), plan));
      // Today is still in progress: sessions not done yet are not "missed", so today only
      // counts what has been done so far (it can raise adherence, never lower it).
      planned += day === today ? doneThatDay : plan.sessionsPerDay;
      done += doneThatDay;
    }
    out.push({
      weekStart,
      label: new Date(weekStart).toLocaleDateString([], { day: 'numeric', month: 'short' }),
      done,
      planned,
      pct: planned ? Math.round((done / planned) * 100) : null,
    });
  }
  return out;
}

// ---------- streaks ----------

export interface Streaks {
  current: number;
  best: number;
}

/**
 * Consecutive days on which the daily target was met (any session counts without a plan).
 * Today only adds to the streak once met; an unfinished today does not break it.
 */
export function streaks(sessions: SessionRecord[], plan: Plan | null, now = Date.now()): Streaks {
  if (!sessions.length) return { current: 0, best: 0 };
  const byDay = sessionsByDay(sessions);
  const target = plan?.sessionsPerDay ?? 1;
  const met = (ts: number) => doneOnDay(byDay.get(dayKey(ts)), plan) >= target;

  let current = 0;
  let day = met(now) ? startOfDay(now) : addDays(now, -1);
  while (met(day)) {
    current++;
    day = addDays(day, -1);
  }

  const first = Math.min(...sessions.map((s) => s.startedAt));
  const total = daysBetween(first, now);
  let best = 0;
  let run = 0;
  for (let i = 0; i <= total; i++) {
    if (met(addDays(first, i))) best = Math.max(best, ++run);
    else run = 0;
  }
  return { current, best: Math.max(best, current) };
}

// ---------- comfort ----------

export interface ComfortPoint {
  value: number;
  ts: number;
}

/** The last `n` comfort scores, oldest first. */
export function comfortTrend(sessions: SessionRecord[], n = 10): ComfortPoint[] {
  return sessions
    .filter((s) => s.comfort !== null)
    .slice(-n)
    .map((s) => ({ value: s.comfort as number, ts: s.startedAt }));
}

export function averageComfort(sessions: SessionRecord[], since: number): number | null {
  const scores = sessions.filter((s) => s.startedAt >= since && s.comfort !== null).map((s) => s.comfort as number);
  if (!scores.length) return null;
  return Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
}
