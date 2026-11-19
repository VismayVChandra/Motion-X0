import { useState } from 'preact/hooks';
import { t } from '../i18n';
import { hrefFor, navigate } from '../router';
import { lastSessionId, runner } from '../session/instance';
import { isHighComfortScore, sessionStore } from '../store/sessions';
import { Icon } from '../ui/Icon';
import { duration } from '../ui/format';
import { endReasonText } from '../ui/session-bits';

export function SessionDone() {
  const id = lastSessionId.value;
  const rec = id ? sessionStore.sessions.value.find((s) => s.id === id) : undefined;
  const [score, setScore] = useState<number | null>(rec?.comfort ?? null);
  const [note, setNote] = useState(rec?.note ?? '');

  if (!rec) {
    return (
      <section class="screen">
        <h1>{t('done.none')}</h1>
        <a class="btn btn-primary btn-lg btn-block" href={hrefFor('home')}>
          {t('done.backHome')}
        </a>
      </section>
    );
  }

  const high = isHighComfortScore(score);
  const save = () => sessionStore.update(rec.id, { comfort: score, note: note.trim() });
  const finish = (doSave: boolean) => {
    if (doSave) save();
    runner.clear();
    navigate('home');
  };

  return (
    <section class="screen" aria-labelledby="done-title">
      <div class={`done-head${rec.endReason === 'estop' ? ' warn' : ''}`}>
        <Icon name={rec.endReason === 'completed' ? 'circleCheck' : rec.endReason === 'estop' ? 'octagonX' : 'flag'} />
        <div class="stack" style={{ gap: 0 }}>
          <strong style={{ fontSize: '17px' }}>{endReasonText(rec.endReason)}</strong>
          <span class="muted small">
            {rec.endReason !== 'completed'
              ? t('done.summaryOf', { time: duration(rec.activeSec), planned: duration(rec.plannedSec), level: rec.level, cycles: rec.cycles })
              : t('done.summary', { time: duration(rec.activeSec), level: rec.level, cycles: rec.cycles })}
          </span>
        </div>
      </div>

      <div class="stack" style={{ gap: '8px' }}>
        <h1 id="done-title">{t('done.question')}</h1>
        <p class="lead" id="comfort-help">
          {t('done.help')}
        </p>
      </div>

      <div class="comfort-grid" role="radiogroup" aria-label={t('done.scoreLabel')} aria-describedby="comfort-help">
        {Array.from({ length: 10 }, (_, i) => {
          const n = i + 1;
          const hue = Math.round(145 - (i * 145) / 9);
          const sel = n === score;
          return (
            <button
              key={n}
              type="button"
              class="cbtn"
              role="radio"
              aria-checked={sel}
              aria-label={n === 1 ? t('done.aria1') : n === 10 ? t('done.aria10') : String(n)}
              style={{ '--h': hue }}
              onClick={() => setScore(n)}
            >
              {n}
              {sel && (
                <span class="cbtn-check">
                  <Icon name="check" />
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div class="scale-labels" aria-hidden="true">
        <span>
          <Icon name="smile" />
          {t('done.veryComfortable')}
        </span>
        <span>
          {t('done.veryUncomfortable')}
          <Icon name="frown" />
        </span>
      </div>

      {high && (
        <div class="advisory" role="alert">
          <Icon name="triangleAlert" />
          <div>
            <strong>{t('done.advice')}</strong>
            <p>{t('done.adviceDetail', { n: score as number })}</p>
          </div>
        </div>
      )}

      <div class="field">
        <label for="session-note">
          {t('done.note')} <span class="muted">{t('common.optional')}</span>
        </label>
        <textarea
          id="session-note"
          class="input"
          maxLength={500}
          placeholder={t('done.notePlaceholder')}
          value={note}
          onInput={(e) => setNote(e.currentTarget.value)}
        />
      </div>

      <button type="button" class="btn btn-primary btn-lg btn-block" disabled={score === null} onClick={() => finish(true)}>
        <Icon name="check" />
        {score === null ? t('done.choose') : t('done.save')}
      </button>
      <div class="btn-pair">
        <button
          type="button"
          class="btn btn-secondary"
          onClick={() => {
            if (score !== null) save();
            runner.clear();
            navigate('report', rec.id);
          }}
        >
          <Icon name="fileText" />
          {t('done.report')}
        </button>
        <button type="button" class="btn btn-ghost" onClick={() => finish(false)}>
          {t('done.skip')}
        </button>
      </div>
    </section>
  );
}
