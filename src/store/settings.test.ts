import { describe, expect, it } from 'vitest';
import { createSettingsStore, DEFAULT_SETTINGS, sanitizeSettings, SETTINGS_KEY, type KeyValueStorage } from './settings';

function memoryStorage(initial: Record<string, string> = {}): KeyValueStorage & { data: Record<string, string> } {
  const data = { ...initial };
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v) };
}

describe('settings store', () => {
  it('starts with defaults (Demo mode on, patient role)', () => {
    const store = createSettingsStore(memoryStorage());
    expect(store.settings.value).toEqual(DEFAULT_SETTINGS);
    expect(store.settings.value.demoMode).toBe(true);
  });

  it('persists updates and reloads them', () => {
    const storage = memoryStorage();
    createSettingsStore(storage).update({ theme: 'dark', demoMode: false });
    const reloaded = createSettingsStore(storage);
    expect(reloaded.settings.value).toMatchObject({ theme: 'dark', demoMode: false });
  });

  it('survives corrupt stored JSON', () => {
    const store = createSettingsStore(memoryStorage({ [SETTINGS_KEY]: '{oops' }));
    expect(store.settings.value).toEqual(DEFAULT_SETTINGS);
  });

  it('works with no storage at all', () => {
    const store = createSettingsStore(null);
    store.update({ role: 'therapist' });
    expect(store.settings.value.role).toBe('therapist');
  });

  it('rejects invalid values field by field', () => {
    expect(
      sanitizeSettings({ theme: 'neon', demoMode: 'yes', deviceUrl: 'http://x', role: 'admin', language: 'kn' }),
    ).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings({ theme: 'light', deviceUrl: 'ws://10.0.0.5/ws' })).toMatchObject({
      theme: 'light',
      deviceUrl: 'ws://10.0.0.5/ws',
    });
  });

  it('reset restores defaults', () => {
    const store = createSettingsStore(memoryStorage());
    store.update({ theme: 'dark' });
    store.reset();
    expect(store.settings.value).toEqual(DEFAULT_SETTINGS);
  });
});
