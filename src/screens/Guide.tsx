import { t } from '../i18n';
import { hrefFor } from '../router';
import { settingsStore } from '../store/settings';
import { Icon, type IconName } from '../ui/Icon';

const STEPS: { icon: IconName; key: string }[] = [
  { icon: 'wifi', key: 'guide.s1' },
  { icon: 'play', key: 'guide.s2' },
  { icon: 'octagonX', key: 'guide.s3' },
  { icon: 'smile', key: 'guide.s4' },
  { icon: 'chartColumn', key: 'guide.s5' },
];

/** In-app quick-start guide (also reachable from Settings and the first-run card on Home). */
export function Guide() {
  return (
    <section class="screen" aria-labelledby="guide-title">
      <div class="stack">
        <p class="eyebrow">{t('guide.eyebrow')}</p>
        <h1 id="guide-title">{t('guide.title')}</h1>
      </div>

      <ol class="steps card guide-steps">
        {STEPS.map((s, i) => (
          <li key={s.key}>
            <span class="step-n">{i + 1}</span>
            <div class="stack">
              <strong>
                <Icon name={s.icon} size={18} /> {t(`${s.key}.title`)}
              </strong>
              <span class="muted small">{t(`${s.key}.text`)}</span>
            </div>
          </li>
        ))}
      </ol>

      <div class="advisory">
        <Icon name="triangleAlert" />
        <div>
          <strong>{t('guide.safetyTitle')}</strong>
          <p>{t('guide.safetyText')}</p>
        </div>
      </div>

      <a class="btn btn-primary btn-lg btn-block" href={hrefFor('device')} onClick={() => settingsStore.update({ guideSeen: true })}>
        <Icon name="link" />
        {t('guide.go')}
      </a>
      <a class="btn btn-ghost btn-block" href={hrefFor('home')} onClick={() => settingsStore.update({ guideSeen: true })}>
        {t('done.backHome')}
      </a>
    </section>
  );
}
