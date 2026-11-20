import { signal, type Signal } from '@preact/signals';
import { PATTERN_IDS, type PatternId, type SpeedLevel } from '../session/patterns';
import type { EndReason, SessionResult } from '../session/runner';
import type { KeyValueStorage } from './settings';

export interface SessionRecord extends SessionResult {
  id: string;
  /** Post-session comfort score: 1 = very comfortable … 10 = very uncomfortable. Null if skipped. */
  comfort: number | null;
  note: string;
}

export const SESSIONS_KEY = 'motionx.sessions.v1';
/** Scores at or above this show advice to stop and consult a therapist. */
export const COMFORT_ADVICE_THRESHOLD = 7;
export const MAX_NOTE_LENGTH = 500;

export const isHighComfortScore = (score: number | null | undefined) =>
  typeof score === 'number' && score >= COMFORT_ADVICE_THRESHOLD;

const END_REASONS: EndReason[] = ['completed', 'ended_early', 'estop'];
const num = (v: unknown, min = 0) => (typeof v === 'number' && Number.isFinite(v) && v >= min ? v : null);

/** Validate one stored record; returns null if it is unusable. */
export function sanitizeRecord(raw: unknown): SessionRecord | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const startedAt = num(r.startedAt);
  const endedAt = num(r.endedAt);
  const plannedSec = num(r.plannedSec, 1);
  const activeSec = num(r.activeSec);
  const cycles = num(r.cycles);
  if (typeof r.id !== 'string' || startedAt === null || endedAt === null || plannedSec === null || activeSec === null) {
    return null;
  }
  if (r.level !== 1 && r.level !== 2 && r.level !== 3) return null;
  const comfort = typeof r.comfort === 'number' && Number.isInteger(r.comfort) && r.comfort >= 1 && r.comfort <= 10 ? r.comfort : null;
  return {
    id: r.id,
    startedAt,
    endedAt,
    plannedSec,
    activeSec,
    level: r.level as SpeedLevel,
    pattern: PATTERN_IDS.includes(r.pattern as PatternId) ? (r.pattern as PatternId) : 'constant',
    cycles: cycles ?? 0,
    endReason: END_REASONS.includes(r.endReason as EndReason) ? (r.endReason as EndReason) : 'ended_early',
    mode: r.mode === 'device' ? 'device' : 'demo',
    comfort,
    note: typeof r.note === 'string' ? r.note.slice(0, MAX_NOTE_LENGTH) : '',
  };
}

export interface SessionStore {
  /** All saved sessions, oldest first. */
  readonly sessions: Signal<SessionRecord[]>;
  add(result: SessionResult): SessionRecord;
  update(id: string, patch: Partial<Pick<SessionRecord, 'comfort' | 'note'>>): void;
  get(id: string): SessionRecord | undefined;
  /** Replace all sessions (sample data). Records are validated. */
  replaceAll(records: SessionRecord[]): void;
  /** Remove every saved session. */
  clear(): void;
}

function safeStorage(): KeyValueStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

let counter = 0;
const newId = (t: number) => `${t.toString(36)}-${(counter++).toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

/**
 * Saved sessions in localStorage (small records, ~250 bytes each: years of use fit
 * comfortably). Data stays in this browser on this device.
 */
export function createSessionStore(storage: KeyValueStorage | null = safeStorage()): SessionStore {
  let initial: SessionRecord[] = [];
  try {
    const raw = storage?.getItem(SESSIONS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) {
      initial = parsed.map(sanitizeRecord).filter((r): r is SessionRecord => r !== null);
    }
  } catch {
    // corrupt data → start empty rather than crash
  }
  initial.sort((a, b) => a.startedAt - b.startedAt);
  const sessions = signal<SessionRecord[]>(initial);

  const persist = () => {
    try {
      storage?.setItem(SESSIONS_KEY, JSON.stringify(sessions.value));
    } catch {
      // storage full or blocked: keep the data in memory for this visit
    }
  };

  return {
    sessions,
    add(result) {
      const record: SessionRecord = { ...result, id: newId(result.startedAt), comfort: null, note: '' };
      sessions.value = [...sessions.value, record];
      persist();
      return record;
    },
    update(id, patch) {
      const clean: Partial<SessionRecord> = {};
      if ('comfort' in patch) {
        const c = patch.comfort;
        clean.comfort = typeof c === 'number' && Number.isInteger(c) && c >= 1 && c <= 10 ? c : null;
      }
      if (typeof patch.note === 'string') clean.note = patch.note.slice(0, MAX_NOTE_LENGTH);
      sessions.value = sessions.value.map((s) => (s.id === id ? { ...s, ...clean } : s));
      persist();
    },
    get(id) {
      return sessions.value.find((s) => s.id === id);
    },
    replaceAll(records) {
      sessions.value = records
        .map(sanitizeRecord)
        .filter((r): r is SessionRecord => r !== null)
        .sort((a, b) => a.startedAt - b.startedAt);
      persist();
    },
    clear() {
      sessions.value = [];
      persist();
    },
  };
}

export const sessionStore = createSessionStore();
