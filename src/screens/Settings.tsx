import { useState } from 'preact/hooks';
import { displayDeviceAddress, normalizeDeviceUrl } from '../device/url';
import { LANGUAGES, t } from '../i18n';
import { hrefFor } from '../router';
import { runner } from '../session/instance';
import { makeSampleData } from '../store/demoData';
import { planStore } from '../store/plan';
import { sessionStore } from '../store/sessions';
import { settingsStore, type Role, type ThemePref } from '../store/settings';
import { Icon, type IconName } from '../ui/Icon';
import { Seg, Switch } from '../ui/controls';
import { speak, voiceSupported } from '../voice/voice';

function Row({
  icon,
  title,
  desc,
  children,
  first,
}: {
  icon: IconName;
  title: string;
  desc?: string;
  children: preact.ComponentChildren;
  first?: boolean;
}) {
  return (
    <div class={`set-row${first ? ' first' : ''}`}>
      <div class="set-left">
        <span class="set-ic">
          <Icon name={icon} />
        </span>
        <div>
          <strong>{title}</strong>
          {desc && <span class="desc">{desc}</span>}
        </div>
      </div>
      {children}
    </div>
  );
}

export function Settings() {
  const s = settingsStore.settings.value;
  const update = settingsStore.update;
  const [addr, setAddr] = useState(displayDeviceAddress(s.deviceUrl));
  const [addrError, setAddrError] = useState<string | null>(null);
  const [dataMsg, setDataMsg] = useState<string | null>(null);

  const saveAddress = () => {
    const url = normalizeDeviceUrl(addr);
    if (!url) {
      setAddrError(t('settings.addressError'));
      return;
    }
    setAddrError(null);
    setAddr(displayDeviceAddress(url));
    if (url !== s.deviceUrl) update({ deviceUrl: url });
  };

  return (
    <section class="screen" aria-labelledby="settings-title">
      <h1 id="settings-title">{t('settings.title')}</h1>

      <section class="card" style={{ gap: 0 }} aria-label={t('settings.device')}>
        <p class="eyebrow" style={{ marginBottom: '4px' }}>
          {t('settings.device')}
        </p>
        <Row first icon="flask" title={t('settings.demo')} desc={t('settings.demoDesc')}>
          <Switch checked={s.demoMode} label={t('settings.demo')} onChange={(v) => update({ demoMode: v })} />
        </Row>
        <div class="set-row column">
          <div class="set-left">
            <span class="set-ic">
              <Icon name="router" />
            </span>
            <div>
              <strong>
                <label for="device-addr">{t('settings.address')}</label>
              </strong>
              <span class="desc">{t('settings.addressDesc')}</span>
            </div>
          </div>
          <input
            id="device-addr"
            class="input"
            value={addr}
            inputMode="url"
            autoComplete="off"
            spellcheck={false}
            aria-invalid={addrError ? true : undefined}
            aria-describedby={addrError ? 'device-addr-err' : undefined}
            onInput={(e) => setAddr(e.currentTarget.value)}
            onBlur={saveAddress}
            onKeyDown={(e) => e.key === 'Enter' && saveAddress()}
          />
          {addrError && (
            <span id="device-addr-err" class="field-error">
              {addrError}
            </span>
          )}
        </div>
      </section>

      <section class="card" style={{ gap: 0 }} aria-label={t('settings.display')}>
        <p class="eyebrow" style={{ marginBottom: '4px' }}>
          {t('settings.display')}
        </p>
        <div class="set-row first column">
          <div class="set-left">
            <span class="set-ic">
              <Icon name="languages" />
            </span>
            <strong>{t('settings.language')}</strong>
          </div>
          <div class="seg compact" role="radiogroup" aria-label={t('settings.language')}>
            {LANGUAGES.map((l) => (
              <button
                key={l.code}
                type="button"
                class="seg-btn"
                role="radio"
                lang={l.code}
                aria-checked={s.language === l.code}
                onClick={() => update({ language: l.code })}
              >
                <span class="seg-main">{l.name}</span>
              </button>
            ))}
          </div>
        </div>
        <div class="set-row column">
          <div class="set-left">
            <span class="set-ic">
              <Icon name="sunMoon" />
            </span>
            <strong>{t('settings.theme')}</strong>
          </div>
          <Seg<ThemePref>
            compact
            label={t('settings.theme')}
            value={s.theme}
            onChange={(theme) => update({ theme })}
            options={[
              { value: 'light', main: t('settings.light') },
              { value: 'dark', main: t('settings.dark') },
              { value: 'system', main: t('settings.auto') },
            ]}
          />
        </div>
        <Row icon="contrast" title={t('settings.contrast')} desc={t('settings.contrastDesc')}>
          <Switch checked={s.highContrast} label={t('settings.contrast')} onChange={(v) => update({ highContrast: v })} />
        </Row>
        <Row icon="eye" title={t('settings.simple')} desc={t('settings.simpleDesc')}>
          <Switch checked={s.simpleMode} label={t('settings.simple')} onChange={(v) => update({ simpleMode: v })} />
        </Row>
      </section>

      <section class="card" style={{ gap: 0 }} aria-label={t('settings.sound')}>
        <p class="eyebrow" style={{ marginBottom: '4px' }}>
          {t('settings.sound')}
        </p>
        <Row
          first
          icon="volume"
          title={t('settings.voice')}
          desc={voiceSupported() ? t('settings.voiceDesc') : t('settings.voiceUnsupported')}
        >
          <Switch
            checked={s.voice && voiceSupported()}
            label={t('settings.voice')}
            onChange={(v) => {
              update({ voice: v });
              if (v) speak('voice.test', { force: true });
            }}
          />
        </Row>
        {s.voice && voiceSupported() && (
          <button type="button" class="btn btn-tonal" style={{ marginTop: '8px' }} onClick={() => speak('voice.test', { force: true })}>
            <Icon name="volume" />
            {t('settings.voiceTest')}
          </button>
        )}
      </section>

      <section class="card" style={{ gap: 0 }} aria-label={t('settings.role')}>
        <p class="eyebrow" style={{ marginBottom: '4px' }}>
          {t('settings.role')}
        </p>
        <div class="set-row first column">
          <Seg<Role>
            compact
            label={t('settings.role')}
            value={s.role}
            onChange={(role) => update({ role })}
            options={[
              { value: 'patient', main: t('role.patient') },
              { value: 'therapist', main: t('role.therapist') },
            ]}
          />
          <span class="muted small">{t('settings.roleDesc')}</span>
        </div>
      </section>

      <section class="card" style={{ gap: 0 }} aria-label={t('settings.data')}>
        <p class="eyebrow" style={{ marginBottom: '4px' }}>
          {t('settings.data')}
        </p>
        <div class="set-row first">
          <div class="set-left">
            <span class="set-ic">
              <Icon name="book" />
            </span>
            <div>
              <strong>{t('settings.guide')}</strong>
              <span class="desc">{t('settings.guideDesc')}</span>
            </div>
          </div>
          <a class="btn btn-tonal" href={hrefFor('guide')}>
            {t('guide.open')}
          </a>
        </div>
        {s.demoMode && (
          <div class="set-row column">
            <div class="set-left">
              <span class="set-ic">
                <Icon name="database" />
              </span>
              <div>
                <strong>{t('settings.sample')}</strong>
                <span class="desc">{t('settings.sampleDesc')}</span>
              </div>
            </div>
            <button
              type="button"
              class="btn btn-secondary"
              disabled={runner.inProgress.value}
              onClick={() => {
                if (sessionStore.sessions.peek().length && !window.confirm(t('settings.sampleConfirm'))) return;
                const { plan, sessions } = makeSampleData();
                sessionStore.replaceAll(sessions);
                planStore.restore(plan);
                setDataMsg(t('settings.sampleDone'));
              }}
            >
              <Icon name="database" />
              {t('settings.sampleLoad')}
            </button>
          </div>
        )}
        <div class="set-row column">
          <button
            type="button"
            class="btn btn-ghost"
            style={{ color: 'var(--danger-text)' }}
            disabled={runner.inProgress.value}
            onClick={() => {
              if (!window.confirm(t('settings.clearConfirm'))) return;
              sessionStore.clear();
              planStore.clear();
              setDataMsg(t('settings.clearDone'));
            }}
          >
            <Icon name="trash" />
            {t('settings.clear')}
          </button>
          {dataMsg && (
            <p class="saved-msg" role="status">
              <Icon name="circleCheck" />
              {dataMsg}
            </p>
          )}
        </div>
      </section>

      <button
        type="button"
        class="btn btn-ghost btn-block"
        onClick={() => {
          settingsStore.reset();
          setAddr(displayDeviceAddress(settingsStore.settings.peek().deviceUrl));
          setAddrError(null);
        }}
      >
        <Icon name="rotateCcw" />
        {t('settings.reset')}
      </button>
      <p class="muted" style={{ textAlign: 'center', fontSize: '14px' }}>
        {t('settings.version', { v: __APP_VERSION__ })}
      </p>
    </section>
  );
}
