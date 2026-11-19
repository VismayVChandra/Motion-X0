import { t } from '../i18n';
import type { Phase, PatternId } from '../session/patterns';
import type { EndReason } from '../session/runner';
import { isHighComfortScore } from '../store/sessions';
import { Icon } from './Icon';

const PATTERN_PATHS: Record<PatternId, string> = {
  constant: 'M4 14 H60',
  warmup: 'M4 24 L20 6 H44 L60 24',
  intervals: 'M4 22 H14 V6 H24 V22 H34 V6 H44 V22 H54 V6 H60',
};

/** Translated names for patterns, phases, levels and end reasons. */
export const patternLabel = (p: PatternId) => t(`pattern.${p}.label`);
export const patternShort = (p: PatternId) => t(`pattern.${p}.short`);
export const patternDesc = (p: PatternId) => t(`pattern.${p}.desc`);
export const levelName = (l: number) => (l >= 1 && l <= 3 ? t(`level.name${l}`) : t('level.stopped'));

const PHASE_KEYS: Record<Phase['name'], string> = {
  Steady: 'steady',
  'Warm-up': 'warmup',
  Hold: 'hold',
  'Cool-down': 'cooldown',
  Busy: 'busy',
  Rest: 'rest',
};
export const phaseName = (name: Phase['name']) => t(`phase.${PHASE_KEYS[name]}`);
export const endReasonText = (r: EndReason) => t(`end.${r}`);

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
      <span class="score mid" title={t('comfort.none')}>
        –
      </span>
    );
  if (isHighComfortScore(score))
    return (
      <span class="score hi">
        <Icon name="triangleAlert" />
        {score} · {t('comfort.high')}
      </span>
    );
  if (score >= 4)
    return (
      <span class="score mid">
        <Icon name="minus" />
        {score} · {t('comfort.okay')}
      </span>
    );
  return (
    <span class="score ok">
      <Icon name="smile" />
      {score} · {t('comfort.comfortable')}
    </span>
  );
}
