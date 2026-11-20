import { t, tn } from '../i18n';
import { comfortTrend, dailyMinutes, startOfDay, streaks, todayProgress, weeklyAdherence } from '../progress/stats';
import { hrefFor, routeParam } from '../router';
import { planStore } from '../store/plan';
import { isHighComfortScore, sessionStore } from '../store/sessions';
import { BarChart, ComfortLineChart } from '../ui/charts';
import { Icon } from '../ui/Icon';
import { duration, fullDate, time, weekdayNarrow } from '../ui/format';
import { ComfortChip, endReasonText, levelName, patternLabel } from '../ui/session-bits';

/** One-page printable session report (prints/saves cleanly as PDF via the print stylesheet). */
export function Report() {
  const id = routeParam.value;
  const sessions = sessionStore.sessions.value;
  const rec = id ? sessions.find((s) => s.id === id) : undefined;
  const plan = planStore.plan.value;

  if (!rec) {
    return (
      <section class="screen">
        <h1>{t('report.notFound')}</h1>
        <a class="btn btn-primary btn-lg btn-block" href={hrefFor('history')}>
          {t('report.back')}
        </a>
      </section>
    );
  }

  // Progress figures as of the day of this session.
  const asOf = rec.endedAt;
  const upTo = sessions.filter((s) => s.startedAt <= asOf);
  // Only use the plan if it already existed when this session was recorded.
  const activePlan = plan && startOfDay(plan.startedAt) <= asOf ? plan : null;
  const week = activePlan ? weeklyAdherence(upTo, activePlan, 1, asOf)[0] : null;
  const day = activePlan ? todayProgress(upTo, activePlan, asOf) : null;
  const streak = streaks(upTo, activePlan, asOf).current;
  const minutes = dailyMinutes(upTo, 7, asOf);
  const goal = activePlan ? activePlan.durationMin * activePlan.sessionsPerDay : undefined;
  const comfort = comfortTrend(upTo, 10);

  const rows: [string, string][] = [
    [t('report.dateTime'), `${fullDate(rec.startedAt)}, ${time(rec.startedAt)}`],
    [
      t('report.duration'),
      rec.activeSec >= rec.plannedSec
        ? duration(rec.activeSec)
        : t('report.durationOf', { time: duration(rec.activeSec), planned: duration(rec.plannedSec) }),
    ],
    [t('device.speedLevel'), `${rec.level} · ${levelName(rec.level)}`],
    [t('setup.pattern'), patternLabel(rec.pattern)],
    [t('report.cycles'), String(rec.cycles)],
    [t('report.ended'), endReasonText(rec.endReason)],
    [t('report.mode'), rec.mode === 'device' ? t('report.modeDevice') : t('report.modeDemo')],
  ];

  return (
    <section class="screen" aria-labelledby="report-title">
      <div class="row-between no-print">
        <a class="link" href={hrefFor('history')}>
          <Icon name="chevronRight" size={18} class="flip" />
          {t('report.back')}
        </a>
        <button type="button" class="btn btn-primary" onClick={() => window.print()}>
          <Icon name="printer" />
          {t('report.print')}
        </button>
      </div>
      <p class="muted small no-print">{t('report.printHint')}</p>

      <article class="card report">
        <header class="report-head">
          <div class="logo">
            <span class="logo-mark">
              <Icon name="activity" />
            </span>
            <span class="logo-word">
              MOTION<span>-X</span>
            </span>
          </div>
          <div class="report-title-block">
            <h1 id="report-title">{t('report.title')}</h1>
            <span class="muted small">{t('report.generated', { date: fullDate(Date.now()) })}</span>
          </div>
        </header>

        <p class="report-notice">
          <Icon name="info" />
          {t('report.disclaimer')}
        </p>

        <div class="report-grid">
          <section class="report-section">
            <h2>{t('report.patient')}</h2>
            <p class="report-patient">{plan?.patientName ?? '—'}</p>
            <dl class="report-dl">
              {rows.map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section class="report-section">
            <h2>{t('report.comfort')}</h2>
            <div class="report-comfort">
              <ComfortChip score={rec.comfort} />
              <span class="muted small">{t('report.comfortScale')}</span>
            </div>
            {isHighComfortScore(rec.comfort) && (
              <p class="report-advice">
                <Icon name="triangleAlert" />
                {t('done.advice')}
              </p>
            )}
            {rec.note && <p class="note-text">“{rec.note}”</p>}

            <h2 style={{ marginTop: '14px' }}>{t('report.plan')}</h2>
            {activePlan && week && day ? (
              <dl class="report-dl">
                <div>
                  <dt>{t('report.prescribed')}</dt>
                  <dd>
                    {t('report.planLine', { level: activePlan.level, min: activePlan.durationMin })} ·{' '}
                    {tn('history.perDay', activePlan.sessionsPerDay)}
                  </dd>
                </div>
                <div>
                  <dt>{t('report.thatDay')}</dt>
                  <dd>{t('report.doneOf', { done: day.done, target: day.target })}</dd>
                </div>
                <div>
                  <dt>{t('report.weekAdherence')}</dt>
                  <dd>
                    {week.pct === null ? '–' : `${week.pct}%`} ({t('therapist.doneOfPlanned', { done: week.done, planned: week.planned })})
                  </dd>
                </div>
                <div>
                  <dt>{t('report.streak')}</dt>
                  <dd>{tn('history.days', streak)}</dd>
                </div>
              </dl>
            ) : (
              <p class="muted">{t('report.noPlan')}</p>
            )}
          </section>
        </div>

        <div class="report-grid">
          <section class="report-section">
            <h2>{t('history.minutes')}</h2>
            <BarChart
              bars={minutes.map((m) => ({
                key: m.key,
                label: weekdayNarrow(m.ts),
                value: m.minutes,
                highlight: m.isToday,
              }))}
              max={Math.max(...minutes.map((m) => m.minutes), goal ?? 0, 5)}
              goal={goal}
              summary={t('history.minutesSummary', {
                range: t('history.last7'),
                list: minutes.map((m) => `${weekdayNarrow(m.ts)} ${m.minutes}`).join(', '),
              })}
            />
          </section>
          <section class="report-section">
            <h2>{t('history.comfort')}</h2>
            {comfort.length ? <ComfortLineChart points={comfort} /> : <p class="muted">{t('history.noScores')}</p>}
          </section>
        </div>

        <footer class="report-foot">
          <div class="sign">
            <span>{t('report.reviewedBy')}</span>
            <span class="sign-line" />
          </div>
          <p class="muted small">
            {t('report.footer', { v: __APP_VERSION__ })} {t('notice')}
          </p>
        </footer>
      </article>
    </section>
  );
}
