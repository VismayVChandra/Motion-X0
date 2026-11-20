import { device } from '../device/instance';
import { t } from '../i18n';
import { route } from '../router';
import { runner, setupChoice } from '../session/instance';
import { settingsStore } from '../store/settings';
import { Icon } from '../ui/Icon';
import { mmss } from '../ui/format';
import { Notice, Topbar } from '../ui/Shell';
import { levelName } from '../ui/session-bits';
import { EstopAlarm, NotReadyNotice } from './DeviceScreen';
import { isNotReadyFault } from '../session/runner';
import { PauseBanner, ProgressRing } from './LiveSession';
import { SessionDone } from './SessionDone';

/**
 * Simple mode: one screen with a big timer and huge buttons, for low vision or low
 * dexterity. The red STOP is the emergency stop and is shown whenever the motor or a
 * session is active.
 */
export function SimpleApp() {
  const showDone = route.value === 'done' && runner.status.value === 'finished';
  return (
    <div class="app simple-app">
      <Topbar />
      <main class="screen-body" id="main">
        {showDone ? <SessionDone /> : <SimpleControl />}
      </main>
      <footer class="bottombar">
        <Notice />
        <div class="simple-exit">
          <button type="button" class="btn btn-ghost btn-block" onClick={() => settingsStore.update({ simpleMode: false })}>
            <Icon name="logOut" />
            {t('simple.exit')}
          </button>
        </div>
      </footer>
    </div>
  );
}

function SimpleControl() {
  const link = device.link.value;
  const st = device.state.value;
  const status = runner.status.value;
  const inProgress = status === 'running' || status === 'paused';
  const choice = setupChoice.value;
  const showStop = inProgress || device.active.value;

  if (link !== 'connected' || !st) {
    return (
      <section class="simple">
        <PauseBanner />
        <div class="simple-status" role="status">
          <span class="spin-ic spin">
            <Icon name="loader" />
          </span>
          <strong>{link === 'lost' ? t('lost.title') : t('connect.looking')}</strong>
        </div>
        <button type="button" class="huge go" onClick={() => (link === 'idle' ? void device.connect() : device.retryNow())}>
          <Icon name="rotateCw" />
          {t('simple.connect')}
        </button>
      </section>
    );
  }

  if (st.fault === 'estop') {
    return (
      <section class="simple">
        <EstopAlarm running={st.running} />
      </section>
    );
  }

  if (isNotReadyFault(st.fault) && !inProgress) {
    return (
      <section class="simple">
        <NotReadyNotice fault={st.fault} />
      </section>
    );
  }

  return (
    <section class="simple" aria-label={t('simple.title')}>
      {inProgress ? (
        <>
          <PauseBanner />
          <ProgressRing big />
        </>
      ) : (
        <div class="simple-timer" role="timer">
          <div class="t">{mmss(choice.minutes * 60_000)}</div>
          <div class="s">{t('simple.ready', { level: choice.level, name: levelName(choice.level) })}</div>
        </div>
      )}

      {status === 'running' ? (
        <button type="button" class="huge pause" onClick={() => runner.pause()}>
          <Icon name="pause" />
          {t('simple.pause')}
        </button>
      ) : status === 'paused' ? (
        <button type="button" class="huge go" onClick={() => runner.resume()}>
          <Icon name="play" />
          {t('simple.resume')}
        </button>
      ) : (
        <button
          type="button"
          class="huge go"
          onClick={() => runner.start({ durationSec: choice.minutes * 60, level: choice.level, pattern: choice.pattern })}
        >
          <Icon name="play" />
          {t('simple.start')}
        </button>
      )}

      {showStop && (
        <button type="button" class="huge stop" onClick={() => device.emergencyStop()}>
          <Icon name="octagonX" />
          {t('simple.stop')}
        </button>
      )}
    </section>
  );
}
