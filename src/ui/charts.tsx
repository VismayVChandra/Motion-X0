import { COMFORT_ADVICE_THRESHOLD } from '../store/sessions';
import type { ComfortPoint } from '../progress/stats';
import { t } from '../i18n';

export interface Bar {
  key: string;
  label: string;
  /** null = no data for this bar (drawn as an empty dashed outline). */
  value: number | null;
  highlight?: boolean;
}

const PLOT_H = 112;

/**
 * Hand-rolled bar chart (no library). Values are printed above bars when there is room,
 * and the whole chart has a text summary for screen readers.
 */
export function BarChart({
  bars,
  max,
  unit = '',
  goal,
  goalLabel,
  summary,
  dense,
}: {
  bars: Bar[];
  max: number;
  unit?: string;
  goal?: number;
  goalLabel?: string;
  summary: string;
  /** Many bars: hide per-bar values and thin out labels. */
  dense?: boolean;
}) {
  const top = Math.max(max, goal ?? 0, 1);
  const labelEvery = dense ? Math.ceil(bars.length / 6) : 1;
  return (
    <div role="img" aria-label={summary}>
      <div class={`bars-plot${dense ? ' dense' : ''}`} style={{ height: `${PLOT_H + 20}px` }}>
        {goal !== undefined && goal > 0 && (
          <div class="goal-line" style={{ bottom: `${(goal / top) * PLOT_H}px` }} />
        )}
        {bars.map((b) => {
          const zero = b.value === null || b.value === 0;
          const h = zero ? 8 : Math.max(4, ((b.value as number) / top) * PLOT_H);
          return (
            <div class="bar-col" key={b.key}>
              {!dense && <span class="bar-val">{b.value === null ? '' : `${fmt(b.value)}${unit}`}</span>}
              <div
                class={`bar${zero ? ' zero' : ''}${b.highlight ? ' hl' : ''}${b.value === null ? ' none' : ''}`}
                style={{ height: `${h}px` }}
              />
            </div>
          );
        })}
      </div>
      <div class={`bars-labels${dense ? ' dense' : ''}`} aria-hidden="true">
        {bars.map((b, i) => (
          <span key={b.key} class={b.highlight ? 'today' : ''}>
            {i % labelEvery === 0 || b.highlight ? b.label : ''}
          </span>
        ))}
      </div>
      {goal !== undefined && goal > 0 && (
        <div class="legend" aria-hidden="true" style={{ marginTop: '6px' }}>
          <span>
            <i class="lg-goal" />
            {goalLabel ?? t('chart.goal', { n: `${goal}${unit}` })}
          </span>
        </div>
      )}
    </div>
  );
}

const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(v < 10 ? 1 : 0));

/** Comfort score trend (1–10, lower is more comfortable) with the advisory threshold. */
export function ComfortLineChart({ points }: { points: ComfortPoint[] }) {
  const W = 300;
  const H = 146;
  const left = 26;
  const right = 296;
  const x = (i: number) => (points.length === 1 ? (left + right) / 2 : left + 4 + (i * (right - left - 8)) / (points.length - 1));
  const y = (v: number) => 12 + ((10 - v) / 9) * 108;
  const pts = points.map((p, i) => `${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const high = points.filter((p) => p.value >= COMFORT_ADVICE_THRESHOLD).length;
  const summary =
    t('chart.comfortSummary', { n: points.length, list: points.map((p) => p.value).join(', ') }) +
    (high ? ' ' + t('chart.comfortHigh', { n: high, level: COMFORT_ADVICE_THRESHOLD }) : '');

  return (
    <>
      <svg class="line-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={summary}>
        {[1, 4, 7, 10].map((v) => (
          <g key={v}>
            <line class="grid" x1={left} x2={right} y1={y(v)} y2={y(v)} />
            <text class="axis" x="4" y={y(v) + 4}>
              {v}
            </text>
          </g>
        ))}
        <line class="thr" x1={left} x2={right} y1={y(COMFORT_ADVICE_THRESHOLD)} y2={y(COMFORT_ADVICE_THRESHOLD)} />
        {points.length > 1 && (
          <>
            <polygon class="area" points={`${x(0)},${y(1)} ${pts} ${x(points.length - 1)},${y(1)}`} />
            <polyline class="ln" points={pts} />
          </>
        )}
        {points.map((p, i) =>
          p.value >= COMFORT_ADVICE_THRESHOLD ? (
            <g key={i}>
              <circle class="pt-hi" cx={x(i)} cy={y(p.value)} r="7" />
              <text class="pt-label" x={x(i) - 4} y={y(p.value) - 12}>
                {p.value}
              </text>
            </g>
          ) : (
            <circle key={i} class="pt" cx={x(i)} cy={y(p.value)} r="4.5" />
          ),
        )}
        <text class="axis" x={left} y="142">
          {t('chart.earlier')}
        </text>
        <text class="axis" x={right} y="142" text-anchor="end">
          {t('chart.latest')}
        </text>
      </svg>
      <div class="legend">
        <span>
          <i class="lg-line" />
          {t('chart.score')}
        </span>
        <span>
          <i class="lg-dash" />
          {t('chart.advisory', { level: COMFORT_ADVICE_THRESHOLD })}
        </span>
        <span>
          <i class="lg-dot" />
          {t('chart.atOrAbove', { level: COMFORT_ADVICE_THRESHOLD })}
        </span>
      </div>
    </>
  );
}
