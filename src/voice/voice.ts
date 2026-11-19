import { effect, untracked } from '@preact/signals';
import { meta, t, type Params } from '../i18n';
import type { SessionRunner } from '../session/runner';
import { settingsStore } from '../store/settings';
import { voiceCue, type VoiceSnapshot } from './cues';

export function voiceSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
}

/** Best installed voice for a BCP 47 tag (exact match first, then same language). */
function pickVoice(tag: string): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices();
  const norm = (s: string) => s.replace('_', '-').toLowerCase();
  return (
    voices.find((v) => norm(v.lang) === norm(tag)) ?? voices.find((v) => norm(v.lang).startsWith(norm(tag).slice(0, 2)))
  );
}

/**
 * Speak a translated prompt with the Web Speech API. Does nothing if voice prompts are off
 * (unless forced, e.g. the Settings test button) or the browser has no speech support.
 */
export function speak(key: string, opts: { force?: boolean; params?: Params } = {}): void {
  if (!voiceSupported()) return;
  if (!opts.force && !settingsStore.settings.peek().voice) return;
  untracked(() => {
    const text = t(key, opts.params);
    const tag = meta.value.speech;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = tag;
    const v = pickVoice(tag);
    if (v) u.voice = v;
    u.rate = 0.95;
    window.speechSynthesis.cancel(); // newest prompt wins
    window.speechSynthesis.speak(u);
  });
}

function snapshot(runner: SessionRunner): VoiceSnapshot {
  const phase = runner.phase.value;
  return {
    status: runner.status.value,
    pauseReason: runner.pauseReason.value,
    endReason: runner.result.value?.endReason ?? null,
    phaseIndex: phase?.index ?? -1,
    phaseLevel: phase?.phase.level ?? 0,
    remainingSec: Math.ceil(runner.remainingMs.value / 1000),
    plannedSec: runner.config.value?.durationSec ?? 0,
  };
}

/** Watch the session and speak prompts (session started, slowing down, finished, ...). */
export function startVoice(runner: SessionRunner): void {
  let prev: VoiceSnapshot | null = null;
  effect(() => {
    const next = snapshot(runner);
    const cue = prev ? voiceCue(prev, next) : null;
    prev = next;
    if (cue) speak(cue);
  });
}
