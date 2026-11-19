import { signal, type Signal } from '@preact/signals';
import { DEFAULT_DEVICE_URL } from '../device/protocol';

export type ThemePref = 'system' | 'light' | 'dark';
export type Role = 'patient' | 'therapist';
export type Language = 'en' | 'hi';

export interface Settings {
  theme: ThemePref;
  /** Use the simulated device instead of the real one. */
  demoMode: boolean;
  deviceUrl: string;
  role: Role;
  language: Language;
}

export const DEFAULT_SETTINGS: Readonly<Settings> = {
  theme: 'system',
  demoMode: true,
  deviceUrl: DEFAULT_DEVICE_URL,
  role: 'patient',
  language: 'en',
};

export const SETTINGS_KEY = 'motionx.settings.v1';

/** Minimal Storage subset so tests can pass an in-memory store. */
export type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem'>;

const pick = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback;

/** Validate untrusted stored data field by field, falling back to defaults. */
export function sanitizeSettings(raw: unknown): Settings {
  const r = raw !== null && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    theme: pick(r.theme, ['system', 'light', 'dark'] as const, DEFAULT_SETTINGS.theme),
    demoMode: typeof r.demoMode === 'boolean' ? r.demoMode : DEFAULT_SETTINGS.demoMode,
    deviceUrl:
      typeof r.deviceUrl === 'string' && /^wss?:\/\/.+/.test(r.deviceUrl) ? r.deviceUrl : DEFAULT_SETTINGS.deviceUrl,
    role: pick(r.role, ['patient', 'therapist'] as const, DEFAULT_SETTINGS.role),
    language: pick(r.language, ['en', 'hi'] as const, DEFAULT_SETTINGS.language),
  };
}

export interface SettingsStore {
  readonly settings: Signal<Settings>;
  update(patch: Partial<Settings>): void;
  reset(): void;
}

function safeStorage(): KeyValueStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null; // blocked storage (private mode, policies)
  }
}

export function createSettingsStore(storage: KeyValueStorage | null = safeStorage()): SettingsStore {
  let initial: Settings = { ...DEFAULT_SETTINGS };
  try {
    const raw = storage?.getItem(SETTINGS_KEY);
    if (raw) initial = sanitizeSettings(JSON.parse(raw));
  } catch {
    // corrupt JSON → defaults
  }
  const settings = signal<Settings>(initial);

  const persist = () => {
    try {
      storage?.setItem(SETTINGS_KEY, JSON.stringify(settings.value));
    } catch {
      // storage full or blocked: keep working in memory
    }
  };

  return {
    settings,
    update(patch) {
      settings.value = sanitizeSettings({ ...settings.value, ...patch });
      persist();
    },
    reset() {
      settings.value = { ...DEFAULT_SETTINGS };
      persist();
    },
  };
}

/** App-wide singleton. */
export const settingsStore = createSettingsStore();
