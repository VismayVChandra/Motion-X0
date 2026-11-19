import { signal } from '@preact/signals';
import { t, tn } from '../i18n';
import { comfortTrend, dailyMinutes, streaks, weeklyAdherence } from '../progress/stats';
import { hrefFor } from '../router';
import { planStore } from '../store/plan';
import { sessionStore } from '../store/sessions';
import { BarChart, ComfortLineChart } from '../ui/charts';
import { Icon } from '../ui/Icon';
import { Seg } from '../ui/controls';
import { shortDate, weekdayNarrow } from '../ui/format';
import { SessionRow } from './Home';

type Range = 'week' | 'month';
const range = signal<Range>('week');

export function History() {
  const sessions = sessionStore.sessions.value;
  const plan = planStore.plan.value;

  if (!sessions.length) {
    return (
      <section class="screen" aria-labelledby="history-title">
        <h1 id="history-title">{t('history.title')}</h1>
        <div class="card empty">
          <span class="empty-ic">
            <Icon name="chartLine" />
          </span>
          <h2 style={{ fontSize: '22px' }}>{t('history.emptyTitle')}</h2>
          <p class="muted">{t('history.emptyText')}</p>
          <div class="ghost-chart" aria-hidden="true">
            {[30, 55, 40, 70, 50, 85, 60].map((h, i) => (
              <div key={i} style={{ height: `${h}%` }} />
            ))}
          </div>
          <a class="btn btn-primary btn-lg btn-block" href={hrefFor('setup')}>
            <Icon name="play" />
            {t('history.firstSession')}
          </a>
        </div>
      </section>
    );
  }

  const days = range.value === 'week' ? 7 : 30;
  const minutes = dailyMinutes(sessions, days);
  const total = Math.round(minutes.reduce((a, b) => a + b.minutes, 0));
  const goal = plan ? plan.durationMin * plan.sessionsPerDay : undefined;
  const maxMin = Math.max(...minutes.map((m) => m.minutes), goal ?? 0, 5);
  const st = streaks(sessions, plan);
  const adherence = plan ? weeklyAdherence(sessions, plan, range.value === 'week' ? 4 : 8) : [];
  const comfort = comfortTrend(sessions, range.value === 'week' ? 10 : 30);
  const all = sessions.slice(-20).reverse();
  const rangeText = range.value === 'week' ? t('history.last7') : t('history.last30');

  return (
    <section class="screen" aria-labelledby="history-title">
      <h1 id="history-title">{t('history.title')}</h1>
      <Seg<Range>
        compact
        label={t('history.range')}
        value={range.value}
        onChange={(r) => (range.value = r)}
        options={[
          { value: 'week', main: t('history.week') },
          { value: 'month', main: t('history.month') },
        ]}
      />

      <div class="card streak-card">
        <span class="streak-ic">
          <Icon name="flame" />
        </span>
        <div class="stack" style={{ gap: 0 }}>
          <span class="streak-num">{tn('history.days', st.current)}</span>
          <span class="muted">
            {t('history.streakBest', { best: tn('history.days', st.best) })}
            {plan ? ` (${tn('history.perDay', plan.sessionsPerDay)})` : ''}
          </span>
        </div>
      </div>

      <section class="card" aria-labelledby="min-title">
        <div class="chart-head">
          <div>
            <h2 id="min-title">{t('history.minutes')}</h2>
            <p>
              {rangeText} · {t('history.totalMin', { n: total })}
              {goal ? ` · ${t('history.planMin', { n: goal })}` : ''}
            </p>
          </div>
        </div>
        <BarChart
          bars={minutes.map((m) => ({
            key: m.key,
            label: days <= 7 ? weekdayNarrow(m.ts) : String(new Date(m.ts).getDate()),
            value: m.minutes,
            highlight: m.isToday,
          }))}
          max={maxMin}
          goal={goal}
          dense={days > 7}
          summary={t('history.minutesSummary', {
            range: rangeText,
            list: minutes.map((m) => `${shortDate(m.ts)} ${m.minutes}`).join(', '),
          })}
        />
      </section>

      <section class="card" aria-labelledby="adh-h-title">
        <div class="chart-head">
          <div>
            <h2 id="adh-h-title">{t('history.adherence')}</h2>
            <p>{plan ? t('history.adherenceSub') : t('history.adherenceNoPlan')}</p>
          </div>
          {plan && adherence.length > 1 && <AdherenceDelta weeks={adherence.map((w) => w.pct)} />}
        </div>
        {plan && (
          <BarChart
            bars={adherence.map((w, i) => ({
              key: String(w.weekStart),
              label: shortDate(w.weekStart),
              value: w.pct,
              highlight: i === adherence.length - 1,
            }))}
            max={100}
            unit="%"
            dense={adherence.length > 4}
            summary={t('history.adherenceSummary', {
              list: adherence.map((w) => `${shortDate(w.weekStart)} ${w.pct === null ? '–' : `${w.pct}%`}`).join(', '),
            })}
          />
        )}
      </section>

      <section class="card" aria-labelledby="cmf-title">
        <div class="chart-head">
          <div>
            <h2 id="cmf-title">{t('history.comfort')}</h2>
            <p>{t('history.comfortSub')}</p>
          </div>
        </div>
        {comfort.length ? <ComfortLineChart points={comfort} /> : <p class="muted">{t('history.noScores')}</p>}
      </section>

      <section class="stack" style={{ gap: '8px' }} aria-labelledby="all-title">
        <h2 id="all-title">{t('history.all')}</h2>
        <p class="muted small">{t('history.tapForReport')}</p>
        <div class="list">
          {all.map((s) => (
            <SessionRow key={s.id} s={s} />
          ))}
        </div>
        {sessions.length > all.length && (
          <p class="muted small">{t('history.showing', { n: all.length, total: sessions.length })}</p>
        )}
      </section>
    </section>
  );
}

function AdherenceDelta({ weeks }: { weeks: (number | null)[] }) {
  const known = weeks.filter((w): w is number => w !== null);
  if (known.length < 2) return null;
  const delta = known[known.length - 1] - known[known.length - 2];
  if (delta === 0) return null;
  return (
    <span class={`badge ${delta > 0 ? 'ok' : 'warn'}`}>
      <Icon name={delta > 0 ? 'trendingUp' : 'trendingDown'} />
      {delta > 0 ? '+' : ''}
      {delta}%
    </span>
  );
}
