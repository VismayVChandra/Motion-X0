import type { EndReason, PauseReason, RunStatus } from '../session/runner';

/** What the voice logic needs to know about the session at one moment. */
export interface VoiceSnapshot {
  status: RunStatus;
  pauseReason: PauseReason | null;
  endReason: EndReason | null;
  phaseIndex: number;
  phaseLevel: number;
  remainingSec: number;
  plannedSec: number;
}

/**
 * Decide which prompt (a translation key) to speak when the session changes, or null.
 * Kept pure so it is easy to test.
 */
export function voiceCue(prev: VoiceSnapshot, next: VoiceSnapshot): string | null {
  if (prev.status !== next.status) {
    if (next.status === 'running') return prev.status === 'paused' ? 'voice.resumed' : 'voice.started';
    if (next.status === 'paused') return next.pauseReason === 'connection' ? 'voice.connectionLost' : 'voice.paused';
    if (next.status === 'finished') {
      if (next.endReason === 'completed') return 'voice.finished';
      if (next.endReason === 'estop') return 'voice.estop';
      return 'voice.ended';
    }
    return null;
  }
  if (next.status !== 'running') return null;
  if (next.phaseIndex !== prev.phaseIndex) {
    if (next.phaseLevel < prev.phaseLevel) return 'voice.slowDown';
    if (next.phaseLevel > prev.phaseLevel) return 'voice.speedUp';
  }
  if (next.plannedSec > 90 && prev.remainingSec > 60 && next.remainingSec <= 60) return 'voice.oneMinute';
  return null;
}
