import { effect, signal, untracked } from '@preact/signals';
import { device } from '../device/instance';
import { navigate } from '../router';
import { planStore } from '../store/plan';
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

  // Whenever the therapist's plan is set or changed, preselect it in session setup.
  effect(() => {
    const plan = planStore.plan.value;
    if (!plan) return;
    untracked(() => {
      setupChoice.value = { ...setupChoice.value, minutes: plan.durationMin, level: plan.level };
    });
  });

  // Closing or reloading mid-session still saves what was done.
  window.addEventListener('pagehide', () => runner.end());
}
