import { useState } from 'preact/hooks';
import { hrefFor, navigate } from '../router';
import { lastSessionId, runner } from '../session/instance';
import { isHighComfortScore, sessionStore } from '../store/sessions';
import { Icon } from '../ui/Icon';
import { duration } from '../ui/format';

const END_TEXT = {
  completed: 'Session complete',
  ended_early: 'Session ended early',
  estop: 'Session ended by emergency stop',
} as const;

export function SessionDone() {
  const id = lastSessionId.value;
  const rec = id ? sessionStore.sessions.value.find((s) => s.id === id) : undefined;
  const [score, setScore] = useState<number | null>(rec?.comfort ?? null);
  const [note, setNote] = useState(rec?.note ?? '');

  if (!rec) {
    return (
      <section class="screen">
        <h1>No session to review</h1>
        <a class="btn btn-primary btn-lg btn-block" href={hrefFor('home')}>
          Back to home
        </a>
      </section>
    );
  }

  const high = isHighComfortScore(score);
  const finish = (save: boolean) => {
    if (save) sessionStore.update(rec.id, { comfort: score, note: note.trim() });
    runner.clear();
    navigate('home');
  };

  return (
    <section class="screen" aria-labelledby="done-title">
      <div class={`done-head${rec.endReason === 'estop' ? ' warn' : ''}`}>
        <Icon name={rec.endReason === 'completed' ? 'circleCheck' : rec.endReason === 'estop' ? 'octagonX' : 'flag'} />
        <div class="stack" style={{ gap: 0 }}>
          <strong style={{ fontSize: '17px' }}>{END_TEXT[rec.endReason]}</strong>
          <span class="muted small">
            {duration(rec.activeSec)}
            {rec.endReason !== 'completed' ? ` of ${duration(rec.plannedSec)}` : ''} · Level {rec.level} · {rec.cycles}{' '}
            cycles · saved
          </span>
        </div>
      </div>

      <div class="stack" style={{ gap: '8px' }}>
        <h1 id="done-title">How comfortable did that feel?</h1>
        <p class="lead" id="comfort-help">
          Tap one number. 1 is very comfortable, 10 is very uncomfortable.
        </p>
      </div>

      <div class="comfort-grid" role="radiogroup" aria-label="Comfort score" aria-describedby="comfort-help">
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
              aria-label={`${n}${n === 1 ? ', very comfortable' : n === 10 ? ', very uncomfortable' : ''}`}
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
          Very comfortable
        </span>
        <span>
          Very uncomfortable
          <Icon name="frown" />
        </span>
      </div>

      {high && (
        <div class="advisory" role="alert">
          <Icon name="triangleAlert" />
          <div>
            <strong>Please stop and consult your therapist before your next session.</strong>
            <p>You scored {score} out of 10. This score is saved with the session for your therapist to see.</p>
          </div>
        </div>
      )}

      <div class="field">
        <label for="session-note">
          Anything to add? <span class="muted">(optional)</span>
        </label>
        <textarea
          id="session-note"
          class="input"
          maxLength={500}
          placeholder="e.g. a little stiff at the start"
          value={note}
          onInput={(e) => setNote(e.currentTarget.value)}
        />
      </div>

      <button type="button" class="btn btn-primary btn-lg btn-block" disabled={score === null} onClick={() => finish(true)}>
        <Icon name="check" />
        {score === null ? 'Choose a number to save' : 'Save and finish'}
      </button>
      <button type="button" class="btn btn-ghost btn-block" onClick={() => finish(false)}>
        Skip for now
      </button>
    </section>
  );
}
