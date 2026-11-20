import { signal, type Signal } from '@preact/signals';
import type { SpeedLevel } from '../session/patterns';
import type { KeyValueStorage } from './settings';

/** Exercise plan set by the therapist for the (single) patient using this device. */
export interface Plan {
  patientName: string;
  level: SpeedLevel;
  durationMin: number;
  sessionsPerDay: number;
  note: string;
  /** When the plan was first created; adherence counts from this day. */
  startedAt: number;
  updatedAt: number;
}

export type PlanInput = Pick<Plan, 'patientName' | 'level' | 'durationMin' | 'sessionsPerDay' | 'note'>;

export const PLAN_KEY = 'motionx.plan.v1';
export const PLAN_DURATIONS = [2, 5, 10, 15, 20] as const;
export const MAX_SESSIONS_PER_DAY = 6;
export const MAX_NAME_LENGTH = 60;
export const MAX_PLAN_NOTE_LENGTH = 300;

const clampInt = (v: unknown, min: number, max: number, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : fallback;

/** Validate and normalise plan fields. Returns null if the plan is unusable. */
export function sanitizePlan(raw: unknown): Plan | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const patientName = typeof r.patientName === 'string' ? r.patientName.trim().slice(0, MAX_NAME_LENGTH) : '';
  if (!patientName) return null;
  const level = r.level === 1 || r.level === 2 || r.level === 3 ? r.level : null;
  if (!level) return null;
  const durationMin = PLAN_DURATIONS.includes(r.durationMin as (typeof PLAN_DURATIONS)[number]) ? (r.durationMin as number) : 10;
  const now = Date.now();
  return {
    patientName,
    level,
    durationMin,
    sessionsPerDay: clampInt(r.sessionsPerDay, 1, MAX_SESSIONS_PER_DAY, 1),
    note: typeof r.note === 'string' ? r.note.trim().slice(0, MAX_PLAN_NOTE_LENGTH) : '',
    startedAt: typeof r.startedAt === 'number' && r.startedAt > 0 ? r.startedAt : now,
    updatedAt: typeof r.updatedAt === 'number' && r.updatedAt > 0 ? r.updatedAt : now,
  };
}

export interface PlanStore {
  readonly plan: Signal<Plan | null>;
  /** Create or update. Keeps the original start date when editing. Returns false if invalid. */
  save(input: PlanInput): boolean;
  /** Set a complete plan as-is (sample data), keeping its dates. */
  restore(plan: Plan): boolean;
  clear(): void;
}

function safeStorage(): KeyValueStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function createPlanStore(storage: KeyValueStorage | null = safeStorage()): PlanStore {
  let initial: Plan | null = null;
  try {
    const raw = storage?.getItem(PLAN_KEY);
    if (raw) initial = sanitizePlan(JSON.parse(raw));
  } catch {
    // corrupt → no plan
  }
  const plan = signal<Plan | null>(initial);
  const persist = () => {
    try {
      storage?.setItem(PLAN_KEY, plan.value ? JSON.stringify(plan.value) : '');
    } catch {
      // keep in memory
    }
  };

  return {
    plan,
    save(input) {
      const now = Date.now();
      const next = sanitizePlan({ ...input, startedAt: plan.value?.startedAt ?? now, updatedAt: now });
      if (!next) return false;
      plan.value = next;
      persist();
      return true;
    },
    restore(p) {
      const next = sanitizePlan(p);
      if (!next) return false;
      plan.value = next;
      persist();
      return true;
    },
    clear() {
      plan.value = null;
      persist();
    },
  };
}

export const planStore = createPlanStore();
