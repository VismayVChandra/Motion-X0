import { signal } from '@preact/signals';
import { comfortTrend, dailyMinutes, streaks, weeklyAdherence } from '../progress/stats';
import { hrefFor } from '../router';
import { planStore } from '../store/plan';
import { sessionStore } from '../store/sessions';
import { BarChart, ComfortLineChart } from '../ui/charts';
import { Icon } from '../ui/Icon';
import { Seg } from '../ui/controls';
import { SessionRow } from './Home';

type Range = 'week' | 'month';
const range = signal<Range>('week');

export function History() {
  const sessions = sessionStore.sessions.value;
  const plan = planStore.plan.value;

  if (!sessions.length) {
    return (
      <section class="screen" aria-labelledby="history-title">
        <h1 id="history-title">History</h1>
        <div class="card empty">
          <span class="empty-ic">
            <Icon name="chartLine" />
          </span>
          <h2 style={{ fontSize: '22px' }}>No sessions yet</h2>
          <p class="muted">Your charts, streak and comfort scores will show up here after your first session.</p>
          <div class="ghost-chart" aria-hidden="true">
            {[30, 55, 40, 70, 50, 85, 60].map((h, i) => (
              <div key={i} style={{ height: `${h}%` }} />
            ))}
          </div>
          <a class="btn btn-primary btn-lg btn-block" href={hrefFor('setup')}>
            <Icon name="play" />
            Set up my first session
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

  return (
    <section class="screen" aria-labelledby="history-title">
      <h1 id="history-title">History</h1>
      <Seg<Range>
        compact
        label="Range"
        value={range.value}
        onChange={(r) => (range.value = r)}
        options={[
          { value: 'week', main: 'Week' },
          { value: 'month', main: 'Month' },
        ]}
      />

      <div class="card streak-card">
        <span class="streak-ic">
          <Icon name="flame" />
        </span>
        <div class="stack" style={{ gap: 0 }}>
          <span class="streak-num">
            {st.current} day{st.current === 1 ? '' : 's'}
          </span>
          <span class="muted">
            Current streak · Best: {st.best} day{st.best === 1 ? '' : 's'}
            {plan ? ` (${plan.sessionsPerDay} session${plan.sessionsPerDay > 1 ? 's' : ''} a day)` : ''}
          </span>
        </div>
      </div>

      <section class="card" aria-labelledby="min-title">
        <div class="chart-head">
          <div>
            <h2 id="min-title">Minutes per day</h2>
            <p>
              {range.value === 'week' ? 'Last 7 days' : 'Last 30 days'} · {total} min in total
              {goal ? ` · plan is ${goal} min a day` : ''}
            </p>
          </div>
        </div>
        <BarChart
          bars={minutes.map((m) => ({ key: m.key, label: m.label, value: m.minutes, highlight: m.isToday }))}
          max={maxMin}
          goal={goal}
          goalLabel={goal ? `Goal ${goal}` : undefined}
          dense={days > 7}
          summary={`Minutes per day, ${range.value === 'week' ? 'last 7 days' : 'last 30 days'}: ${minutes
            .map((m) => `${new Date(m.ts).toLocaleDateString([], { day: 'numeric', month: 'short' })} ${m.minutes}`)
            .join(', ')}.`}
        />
      </section>

      <section class="card" aria-labelledby="adh-h-title">
        <div class="chart-head">
          <div>
            <h2 id="adh-h-title">Plan adherence</h2>
            <p>{plan ? 'Sessions done vs. planned, per week' : 'Shown once your therapist sets a plan'}</p>
          </div>
          {plan && adherence.length > 1 && <AdherenceDelta weeks={adherence.map((w) => w.pct)} />}
        </div>
        {plan ? (
          <BarChart
            bars={adherence.map((w, i) => ({
              key: String(w.weekStart),
              label: w.label,
              value: w.pct,
              highlight: i === adherence.length - 1,
            }))}
            max={100}
            unit="%"
            dense={adherence.length > 4}
            summary={`Weekly adherence: ${adherence
              .map((w) => `week of ${w.label} ${w.pct === null ? 'no plan' : `${w.pct}%`}`)
              .join(', ')}.`}
          />
        ) : (
          <a class="link" href={hrefFor('home')}>
            No plan yet
          </a>
        )}
      </section>

      <section class="card" aria-labelledby="cmf-title">
        <div class="chart-head">
          <div>
            <h2 id="cmf-title">Comfort score trend</h2>
            <p>Lower is more comfortable</p>
          </div>
        </div>
        {comfort.length ? <ComfortLineChart points={comfort} /> : <p class="muted">No comfort scores yet.</p>}
      </section>

      <section class="stack" style={{ gap: '8px' }} aria-labelledby="all-title">
        <h2 id="all-title">All sessions</h2>
        <div class="list">
          {all.map((s) => (
            <SessionRow key={s.id} s={s} />
          ))}
        </div>
        {sessions.length > all.length && <p class="muted small">Showing the latest {all.length} of {sessions.length}.</p>}
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
