import { signal } from '@preact/signals';
import { device } from '../device/instance';
import { navigate } from '../router';
import { sessionStore } from '../store/sessions';
import { SessionRunner } from './runner';
import type { PatternId, SpeedLevel } from './patterns';

/** Id of the session just finished, for the comfort check screen. */
export const lastSessionId = signal<string | null>(null);

/** Session setup choices, remembered while the app is open. */
export const setupChoice = signal<{ minutes: number; level: SpeedLevel; pattern: PatternId }>({
  minutes: 10,
  level: 1,
  pattern: 'warmup',
});

/** App-wide session runner. Every finished session is saved immediately, then the comfort check opens. */
export const runner = new SessionRunner(device, (result) => {
  const record = sessionStore.add(result);
  lastSessionId.value = record.id;
  navigate('done');
});

let started = false;
export function startSessions(): void {
  if (started) return;
  started = true;
  // Closing or reloading mid-session still saves what was done.
  window.addEventListener('pagehide', () => runner.end());
}
