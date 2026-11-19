import type { PatternId } from '../session/patterns';
import { isHighComfortScore } from '../store/sessions';
import { Icon } from './Icon';

const PATTERN_PATHS: Record<PatternId, string> = {
  constant: 'M4 14 H60',
  warmup: 'M4 24 L20 6 H44 L60 24',
  intervals: 'M4 22 H14 V6 H24 V22 H34 V6 H44 V22 H54 V6 H60',
};

/** Tiny drawing of a pattern's speed over time. */
export function PatternIcon({ pattern }: { pattern: PatternId }) {
  return (
    <svg class="pattern-svg" viewBox="0 0 64 28" aria-hidden="true" focusable="false">
      <path d={PATTERN_PATHS[pattern]} />
    </svg>
  );
}

/** Comfort score pill: icon + number + word, never colour alone. */
export function ComfortChip({ score }: { score: number | null }) {
  if (score === null)
    return (
      <span class="score mid" title="No comfort score">
        –
      </span>
    );
  if (isHighComfortScore(score))
    return (
      <span class="score hi">
        <Icon name="triangleAlert" />
        {score} · High
      </span>
    );
  if (score >= 4)
    return (
      <span class="score mid">
        <Icon name="minus" />
        {score} · Okay
      </span>
    );
  return (
    <span class="score ok">
      <Icon name="smile" />
      {score} · Comfortable
    </span>
  );
}
