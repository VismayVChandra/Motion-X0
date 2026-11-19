import { describe, expect, it } from 'vitest';
import { voiceCue, type VoiceSnapshot } from './cues';

const base: VoiceSnapshot = {
  status: 'running',
  pauseReason: null,
  endReason: null,
  phaseIndex: 0,
  phaseLevel: 2,
  remainingSec: 300,
  plannedSec: 600,
};
const s = (over: Partial<VoiceSnapshot>): VoiceSnapshot => ({ ...base, ...over });

describe('voiceCue', () => {
  it('announces start, pause, resume and connection loss', () => {
    expect(voiceCue(s({ status: 'idle' }), base)).toBe('voice.started');
    expect(voiceCue(base, s({ status: 'paused', pauseReason: 'user' }))).toBe('voice.paused');
    expect(voiceCue(s({ status: 'paused' }), base)).toBe('voice.resumed');
    expect(voiceCue(base, s({ status: 'paused', pauseReason: 'connection' }))).toBe('voice.connectionLost');
  });

  it('announces how the session ended', () => {
    expect(voiceCue(base, s({ status: 'finished', endReason: 'completed' }))).toBe('voice.finished');
    expect(voiceCue(base, s({ status: 'finished', endReason: 'estop' }))).toBe('voice.estop');
    expect(voiceCue(base, s({ status: 'finished', endReason: 'ended_early' }))).toBe('voice.ended');
  });

  it('says "slowing down" when a phase lowers the level, "speeding up" when it raises it', () => {
    expect(voiceCue(base, s({ phaseIndex: 1, phaseLevel: 1 }))).toBe('voice.slowDown');
    expect(voiceCue(base, s({ phaseIndex: 1, phaseLevel: 3 }))).toBe('voice.speedUp');
    expect(voiceCue(base, s({ phaseIndex: 1, phaseLevel: 2 }))).toBeNull();
  });

  it('gives a one-minute warning once, only for sessions longer than 90 s', () => {
    expect(voiceCue(s({ remainingSec: 61 }), s({ remainingSec: 60 }))).toBe('voice.oneMinute');
    expect(voiceCue(s({ remainingSec: 60 }), s({ remainingSec: 59 }))).toBeNull();
    expect(voiceCue(s({ remainingSec: 61, plannedSec: 60 }), s({ remainingSec: 60, plannedSec: 60 }))).toBeNull();
  });

  it('stays quiet while nothing changes or the session is paused', () => {
    expect(voiceCue(base, s({ remainingSec: 299 }))).toBeNull();
    const paused = s({ status: 'paused' });
    expect(voiceCue(paused, s({ status: 'paused', phaseIndex: 2, phaseLevel: 1 }))).toBeNull();
  });
});
